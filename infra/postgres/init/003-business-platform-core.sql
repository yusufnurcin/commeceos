CREATE EXTENSION IF NOT EXISTS pgcrypto;

\connect commerce_os_gateway

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth_core;
CREATE SCHEMA IF NOT EXISTS event_core;
CREATE SCHEMA IF NOT EXISTS bridge_core;

CREATE TABLE IF NOT EXISTS auth_core.principals (
  principal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_type text NOT NULL,
  email text UNIQUE,
  email_verified_at timestamptz,
  status text NOT NULL DEFAULT 'pending_verification',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT principals_status_check CHECK (status IN ('pending_verification', 'active', 'suspended', 'revoked'))
);

CREATE TABLE IF NOT EXISTS auth_core.password_credentials (
  credential_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES auth_core.principals(principal_id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_hash_algorithm text NOT NULL,
  password_updated_at timestamptz NOT NULL DEFAULT now(),
  must_rotate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_core.devices (
  device_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES auth_core.principals(principal_id) ON DELETE CASCADE,
  tenant_id text,
  device_fingerprint_hash text NOT NULL,
  trust_state text NOT NULL DEFAULT 'unknown',
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT devices_trust_state_check CHECK (trust_state IN ('unknown', 'trusted', 'revoked'))
);

CREATE TABLE IF NOT EXISTS auth_core.refresh_token_families (
  family_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES auth_core.principals(principal_id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  workspace_id text NOT NULL,
  device_id uuid REFERENCES auth_core.devices(device_id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT refresh_family_status_check CHECK (status IN ('active', 'revoked', 'reused'))
);

CREATE TABLE IF NOT EXISTS auth_core.refresh_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES auth_core.refresh_token_families(family_id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  previous_token_id uuid REFERENCES auth_core.refresh_tokens(token_id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS auth_core.sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES auth_core.principals(principal_id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  workspace_id text NOT NULL,
  refresh_token_family_id uuid NOT NULL REFERENCES auth_core.refresh_token_families(family_id) ON DELETE CASCADE,
  session_fingerprint_hash text NOT NULL,
  device_id uuid REFERENCES auth_core.devices(device_id) ON DELETE SET NULL,
  mfa_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT sessions_status_check CHECK (status IN ('active', 'rotated', 'revoked', 'expired'))
);

CREATE TABLE IF NOT EXISTS auth_core.mfa_factors (
  factor_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES auth_core.principals(principal_id) ON DELETE CASCADE,
  factor_type text NOT NULL,
  secret_ref text NOT NULL,
  verified_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mfa_factor_type_check CHECK (factor_type IN ('totp', 'webauthn', 'recovery-code', 'email-otp'))
);

CREATE TABLE IF NOT EXISTS auth_core.mfa_challenges (
  challenge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES auth_core.principals(principal_id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  workspace_id text NOT NULL,
  challenge_hash text NOT NULL,
  required_reason text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_core.email_verifications (
  verification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES auth_core.principals(principal_id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_core.workspace_access_grants (
  grant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES auth_core.principals(principal_id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  workspace_id text NOT NULL,
  role_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  permission_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_core.impersonation_grants (
  impersonation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_principal_id uuid NOT NULL REFERENCES auth_core.principals(principal_id) ON DELETE CASCADE,
  target_principal_id uuid NOT NULL REFERENCES auth_core.principals(principal_id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  workspace_id text NOT NULL,
  reason text NOT NULL,
  mfa_verified boolean NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS auth_core.login_activity (
  login_activity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid REFERENCES auth_core.principals(principal_id) ON DELETE SET NULL,
  tenant_id text,
  workspace_id text,
  ip_hash text NOT NULL,
  user_agent_hash text NOT NULL,
  device_id uuid REFERENCES auth_core.devices(device_id) ON DELETE SET NULL,
  result text NOT NULL,
  risk_level text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT login_activity_result_check CHECK (result IN ('accepted', 'challenged', 'rejected')),
  CONSTRAINT login_activity_risk_check CHECK (risk_level IN ('low', 'medium', 'high', 'blocked'))
);

CREATE TABLE IF NOT EXISTS auth_core.suspicious_login_signals (
  signal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login_activity_id uuid NOT NULL REFERENCES auth_core.login_activity(login_activity_id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  signal_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_core.auth_audit_events (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  workspace_id text,
  actor_principal_id uuid REFERENCES auth_core.principals(principal_id) ON DELETE SET NULL,
  action text NOT NULL,
  resource text NOT NULL,
  result text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text NOT NULL,
  trace_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_registry.tenants (
  tenant_id text PRIMARY KEY,
  lifecycle_state text NOT NULL DEFAULT 'provisioning',
  isolation_mode text NOT NULL DEFAULT 'schema-per-tenant',
  default_locale text NOT NULL,
  default_currency text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_lifecycle_state_check CHECK (lifecycle_state IN ('provisioning', 'active', 'suspended', 'archived'))
);

CREATE TABLE IF NOT EXISTS tenant_registry.tenant_lifecycle_events (
  lifecycle_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenant_registry.tenants(tenant_id) ON DELETE CASCADE,
  from_state text,
  to_state text NOT NULL,
  reason text,
  correlation_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_registry.tenant_domains (
  domain_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenant_registry.tenants(tenant_id) ON DELETE CASCADE,
  host text NOT NULL UNIQUE,
  workspace_type text,
  verified boolean NOT NULL DEFAULT false,
  ssl_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_registry.tenant_workspaces (
  tenant_workspace_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenant_registry.tenants(tenant_id) ON DELETE CASCADE,
  workspace_id text NOT NULL,
  workspace_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  role_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  UNIQUE (tenant_id, workspace_id)
);

CREATE TABLE IF NOT EXISTS tenant_registry.tenant_feature_flags (
  feature_flag_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenant_registry.tenants(tenant_id) ON DELETE CASCADE,
  flag_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  rollout_strategy text NOT NULL DEFAULT 'workspace',
  UNIQUE (tenant_id, flag_key)
);

CREATE TABLE IF NOT EXISTS tenant_registry.tenant_limits (
  tenant_id text PRIMARY KEY REFERENCES tenant_registry.tenants(tenant_id) ON DELETE CASCADE,
  max_workspaces integer NOT NULL,
  max_users integer NOT NULL,
  max_storage_gb integer NOT NULL,
  max_events_per_minute integer NOT NULL,
  max_queue_depth integer NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_registry.tenant_branding (
  tenant_id text PRIMARY KEY REFERENCES tenant_registry.tenants(tenant_id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  logo_asset_key text,
  color_tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_domain_required_for_public_branding boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS tenant_registry.tenant_locale_currency (
  tenant_id text PRIMARY KEY REFERENCES tenant_registry.tenants(tenant_id) ON DELETE CASCADE,
  default_locale text NOT NULL,
  supported_locales text[] NOT NULL,
  default_currency text NOT NULL,
  supported_currencies text[] NOT NULL,
  timezone text NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_registry.tenant_erp_bridges (
  bridge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenant_registry.tenants(tenant_id) ON DELETE CASCADE,
  engine text NOT NULL DEFAULT 'odoo',
  odoo_database text NOT NULL,
  odoo_company_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  raw_ui_allowed boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS tenant_registry.tenant_commerce_bridges (
  bridge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenant_registry.tenants(tenant_id) ON DELETE CASCADE,
  engine text NOT NULL DEFAULT 'medusa',
  medusa_region_scope text NOT NULL,
  admin_ui_allowed boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS event_core.event_contracts (
  event_name text PRIMARY KEY,
  domain text NOT NULL,
  current_version integer NOT NULL,
  minimum_supported_version integer NOT NULL,
  tenant_scoped boolean NOT NULL DEFAULT true,
  workspace_scoped boolean NOT NULL DEFAULT false,
  idempotency_required boolean NOT NULL DEFAULT true,
  audit_required boolean NOT NULL DEFAULT true,
  realtime_fanout boolean NOT NULL DEFAULT true,
  payload_schema_ref text NOT NULL
);

CREATE TABLE IF NOT EXISTS event_core.event_outbox (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  event_version integer NOT NULL,
  tenant_id text NOT NULL,
  workspace_id text,
  idempotency_key text NOT NULL,
  correlation_id text NOT NULL,
  trace_id text NOT NULL,
  payload jsonb NOT NULL,
  delivery_state text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT event_outbox_state_check CHECK (delivery_state IN ('pending', 'published', 'consumed', 'retrying', 'dead-lettered', 'replayed'))
);

CREATE TABLE IF NOT EXISTS event_core.event_inbox (
  inbox_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  consumer_name text NOT NULL,
  tenant_id text NOT NULL,
  processed_at timestamptz,
  error text,
  UNIQUE (event_id, consumer_name)
);

CREATE TABLE IF NOT EXISTS event_core.event_dead_letters (
  dead_letter_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  tenant_id text NOT NULL,
  event_name text NOT NULL,
  failure_reason text NOT NULL,
  original_envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  replayed_at timestamptz
);

CREATE TABLE IF NOT EXISTS event_core.event_replay_jobs (
  replay_job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  requested_by uuid REFERENCES auth_core.principals(principal_id) ON DELETE SET NULL,
  reason text NOT NULL,
  filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT replay_job_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS event_core.event_audit (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid,
  tenant_id text NOT NULL,
  event_name text NOT NULL,
  action text NOT NULL,
  actor_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text NOT NULL,
  trace_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bridge_core.odoo_sync_jobs (
  sync_job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  workspace_id text NOT NULL,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS bridge_core.medusa_orchestration_jobs (
  orchestration_job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  workspace_id text NOT NULL,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS sessions_tenant_workspace_idx ON auth_core.sessions (tenant_id, workspace_id);
CREATE INDEX IF NOT EXISTS workspace_access_grants_scope_idx ON auth_core.workspace_access_grants (tenant_id, workspace_id);
CREATE INDEX IF NOT EXISTS event_outbox_delivery_idx ON event_core.event_outbox (delivery_state, occurred_at);
CREATE INDEX IF NOT EXISTS event_dead_letters_tenant_idx ON event_core.event_dead_letters (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS odoo_sync_jobs_status_idx ON bridge_core.odoo_sync_jobs (tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS medusa_orchestration_jobs_status_idx ON bridge_core.medusa_orchestration_jobs (tenant_id, status, created_at);
