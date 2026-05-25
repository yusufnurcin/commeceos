CREATE EXTENSION IF NOT EXISTS pgcrypto;

\connect commerce_os_gateway

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS platform_control;
CREATE SCHEMA IF NOT EXISTS tenant_registry;
CREATE SCHEMA IF NOT EXISTS tenant_isolation;

CREATE TABLE IF NOT EXISTS platform_control.runtime_services (
  service_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL UNIQUE,
  runtime_layer text NOT NULL,
  discovery_name text NOT NULL,
  criticality text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_control.role_contracts (
  role_id text PRIMARY KEY,
  role_name text NOT NULL,
  scope text NOT NULL,
  tenant_bound boolean NOT NULL,
  workspace_bound boolean NOT NULL,
  contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_control.permission_blueprints (
  permission_id text PRIMARY KEY,
  resource text NOT NULL,
  action text NOT NULL,
  scope text NOT NULL,
  effect text NOT NULL,
  contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_control.audit_log_contracts (
  audit_contract_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  actor_type text NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  resource text NOT NULL,
  result text NOT NULL,
  correlation_id text NOT NULL,
  trace_id text NOT NULL,
  payload jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_registry.workspaces (
  workspace_id text PRIMARY KEY,
  tenant_id text,
  workspace_type text NOT NULL,
  isolated_by_tenant boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_isolation.isolation_plans (
  tenant_id text PRIMARY KEY,
  isolation_mode text NOT NULL,
  data_residency_mode text NOT NULL,
  postgres_database text,
  postgres_schema text,
  redis_key_prefix text NOT NULL,
  minio_bucket_prefix text NOT NULL,
  meilisearch_index_prefix text NOT NULL,
  erp_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
