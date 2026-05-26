\connect commerce_os_gateway

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS workspace_runtime;
CREATE SCHEMA IF NOT EXISTS operational_audit;
CREATE SCHEMA IF NOT EXISTS ai_ops;

ALTER TABLE auth_core.principals
  ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE tenant_registry.tenants
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS timezone text;

ALTER TABLE tenant_registry.tenant_erp_bridges
  ADD COLUMN IF NOT EXISTS provisioning_status text NOT NULL DEFAULT 'placeholder_pending';
ALTER TABLE tenant_registry.tenant_erp_bridges
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE tenant_registry.tenant_commerce_bridges
  ADD COLUMN IF NOT EXISTS provisioning_status text NOT NULL DEFAULT 'placeholder_pending';
ALTER TABLE tenant_registry.tenant_commerce_bridges
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

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

CREATE TABLE IF NOT EXISTS platform_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  status text NOT NULL,
  version text NOT NULL,
  installed_version text,
  is_core boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT false,
  requires_license boolean NOT NULL DEFAULT false,
  license_status text NOT NULL DEFAULT 'not_required',
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_modules_key_check CHECK (key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  CONSTRAINT platform_modules_status_check CHECK (status IN ('installed', 'active', 'disabled', 'blocked')),
  CONSTRAINT platform_modules_license_status_check CHECK (license_status IN ('not_required', 'valid', 'missing', 'expired'))
);

CREATE TABLE IF NOT EXISTS platform_module_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES platform_modules(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_principal_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_module_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES platform_modules(id) ON DELETE CASCADE,
  tenant_id text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (module_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS platform_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  industry text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'available',
  version text NOT NULL,
  is_core boolean NOT NULL DEFAULT true,
  is_premium boolean NOT NULL DEFAULT false,
  supports_dark_mode boolean NOT NULL DEFAULT true,
  supports_mobile boolean NOT NULL DEFAULT true,
  supports_rtl boolean NOT NULL DEFAULT false,
  preview_image_url text,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  design_tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  layout_presets jsonb NOT NULL DEFAULT '{}'::jsonb,
  required_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_themes_key_check CHECK (key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  CONSTRAINT platform_themes_status_check CHECK (status IN ('available', 'active', 'disabled', 'deprecated'))
);

CREATE TABLE IF NOT EXISTS platform_theme_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenant_registry.tenants(tenant_id) ON DELETE CASCADE,
  theme_id uuid NOT NULL REFERENCES platform_themes(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',
  assigned_by_principal_id uuid,
  activated_at timestamptz,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id),
  CONSTRAINT platform_theme_assignments_status_check CHECK (status IN ('active', 'inactive', 'staged'))
);

CREATE TABLE IF NOT EXISTS platform_theme_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid REFERENCES platform_themes(id) ON DELETE SET NULL,
  tenant_id text REFERENCES tenant_registry.tenants(tenant_id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_principal_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO event_core.event_contracts
  (event_name, domain, current_version, minimum_supported_version, tenant_scoped, workspace_scoped, idempotency_required, audit_required, realtime_fanout, payload_schema_ref)
VALUES
  ('workflow.command.accepted', 'workflow', 1, 1, true, true, true, true, true, 'schema://events/workflow.command.accepted.v1'),
  ('tenant_created', 'tenant', 1, 1, true, false, true, true, true, 'schema://events/tenant.created.v1'),
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
CREATE INDEX IF NOT EXISTS platform_modules_category_status_idx ON platform_modules (category, status, is_enabled);
CREATE INDEX IF NOT EXISTS platform_module_events_module_idx ON platform_module_events (module_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_module_settings_module_idx ON platform_module_settings (module_id, tenant_id);
CREATE INDEX IF NOT EXISTS platform_themes_industry_category_idx ON platform_themes (industry, category, status);
CREATE INDEX IF NOT EXISTS platform_theme_assignments_theme_idx ON platform_theme_assignments (theme_id, status);
CREATE INDEX IF NOT EXISTS platform_theme_events_tenant_idx ON platform_theme_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_theme_events_theme_idx ON platform_theme_events (theme_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_erp_bridge_engine_idx ON tenant_registry.tenant_erp_bridges (tenant_id, engine);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_commerce_bridge_engine_idx ON tenant_registry.tenant_commerce_bridges (tenant_id, engine);
