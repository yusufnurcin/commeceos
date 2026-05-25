\connect commerce_os_gateway

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS workspace_runtime;
CREATE SCHEMA IF NOT EXISTS operational_audit;
CREATE SCHEMA IF NOT EXISTS ai_ops;

ALTER TABLE tenant_isolation.isolation_plans
  ADD COLUMN IF NOT EXISTS cache_namespace text,
  ADD COLUMN IF NOT EXISTS queue_namespace text,
  ADD COLUMN IF NOT EXISTS event_namespace text,
  ADD COLUMN IF NOT EXISTS storage_namespace text;

CREATE UNIQUE INDEX IF NOT EXISTS devices_principal_fingerprint_idx
  ON auth_core.devices (principal_id, device_fingerprint_hash);

CREATE TABLE IF NOT EXISTS auth_core.password_reset_requests (
  password_reset_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  requested_ip_hash text NOT NULL,
  user_agent_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_runtime.layout_memory (
  layout_memory_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  workspace_id text NOT NULL,
  principal_id uuid,
  layout_key text NOT NULL,
  layout_state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, workspace_id, principal_id, layout_key)
);

CREATE TABLE IF NOT EXISTS workspace_runtime.activity_stream (
  activity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  workspace_id text NOT NULL,
  activity_type text NOT NULL,
  resource text NOT NULL,
  result text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text NOT NULL,
  trace_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_runtime.notifications (
  notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  workspace_id text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_severity_check CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE TABLE IF NOT EXISTS workspace_runtime.worker_heartbeats (
  worker_id text PRIMARY KEY,
  tenant_id text,
  workspace_id text,
  queue_name text NOT NULL,
  status text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS operational_audit.audit_events (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  workspace_id text,
  actor_id text NOT NULL,
  actor_type text NOT NULL,
  action text NOT NULL,
  resource text NOT NULL,
  result text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text NOT NULL,
  trace_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_ops.operational_signals (
  signal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  workspace_id text,
  signal_type text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  subject_ref text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT ai_signal_type_check CHECK (signal_type IN ('operational_recommendation', 'sync_anomaly', 'inventory_anomaly', 'fraud_signal')),
  CONSTRAINT ai_signal_severity_check CHECK (severity IN ('info', 'warning', 'critical')),
  CONSTRAINT ai_signal_status_check CHECK (status IN ('open', 'acknowledged', 'resolved'))
);

INSERT INTO event_core.event_contracts
  (event_name, domain, current_version, minimum_supported_version, tenant_scoped, workspace_scoped, idempotency_required, audit_required, realtime_fanout, payload_schema_ref)
VALUES
  ('workflow.command.accepted', 'workflow', 1, 1, true, true, true, true, true, 'schema://events/workflow.command.accepted.v1'),
  ('sync.job.requested', 'sync', 1, 1, true, false, true, true, true, 'schema://events/sync.job.requested.v1'),
  ('erp.bridge.operation.requested', 'erp-bridge', 1, 1, true, true, true, true, true, 'schema://events/erp.bridge.operation.requested.v1'),
  ('commerce.orchestration.requested', 'commerce', 1, 1, true, true, true, true, true, 'schema://events/commerce.orchestration.requested.v1'),
  ('notification.dispatch.requested', 'notification', 1, 1, true, true, true, true, true, 'schema://events/notification.dispatch.requested.v1')
ON CONFLICT (event_name) DO UPDATE
SET current_version = excluded.current_version,
    minimum_supported_version = excluded.minimum_supported_version,
    tenant_scoped = excluded.tenant_scoped,
    workspace_scoped = excluded.workspace_scoped,
    idempotency_required = excluded.idempotency_required,
    audit_required = excluded.audit_required,
    realtime_fanout = excluded.realtime_fanout,
    payload_schema_ref = excluded.payload_schema_ref;

CREATE INDEX IF NOT EXISTS password_reset_requests_email_idx ON auth_core.password_reset_requests (email_hash, created_at);
CREATE INDEX IF NOT EXISTS activity_stream_tenant_workspace_idx ON workspace_runtime.activity_stream (tenant_id, workspace_id, occurred_at);
CREATE INDEX IF NOT EXISTS notifications_tenant_workspace_idx ON workspace_runtime.notifications (tenant_id, workspace_id, created_at);
CREATE INDEX IF NOT EXISTS audit_events_tenant_workspace_idx ON operational_audit.audit_events (tenant_id, workspace_id, occurred_at);
CREATE INDEX IF NOT EXISTS ai_operational_signals_scope_idx ON ai_ops.operational_signals (tenant_id, workspace_id, created_at);
