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

CREATE TABLE IF NOT EXISTS platform_plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'installed',
  version text NOT NULL,
  installed_version text,
  provider text NOT NULL,
  source_type text NOT NULL,
  is_core boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT false,
  requires_license boolean NOT NULL DEFAULT false,
  license_status text NOT NULL DEFAULT 'not_required',
  required_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  install_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_plugins_key_check CHECK (key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  CONSTRAINT platform_plugins_status_check CHECK (status IN ('installed', 'active', 'disabled', 'blocked')),
  CONSTRAINT platform_plugins_license_status_check CHECK (license_status IN ('not_required', 'valid', 'missing', 'expired'))
);

CREATE TABLE IF NOT EXISTS platform_plugin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id uuid NOT NULL REFERENCES platform_plugins(id) ON DELETE CASCADE,
  tenant_id text REFERENCES tenant_registry.tenants(tenant_id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (plugin_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS platform_plugin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id uuid REFERENCES platform_plugins(id) ON DELETE SET NULL,
  tenant_id text REFERENCES tenant_registry.tenants(tenant_id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_principal_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_integration_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'available',
  provider_type text NOT NULL,
  is_core boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT false,
  supports_test_connection boolean NOT NULL DEFAULT false,
  supports_fallback boolean NOT NULL DEFAULT false,
  required_plugin_key text,
  required_module_key text,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  credential_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  health_check_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_integration_providers_key_check CHECK (key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  CONSTRAINT platform_integration_providers_status_check CHECK (status IN ('available', 'active', 'disabled', 'degraded'))
);

CREATE TABLE IF NOT EXISTS platform_integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES platform_integration_providers(id) ON DELETE CASCADE,
  tenant_id text REFERENCES tenant_registry.tenants(tenant_id) ON DELETE CASCADE,
  scope text NOT NULL,
  label text NOT NULL,
  encrypted_payload text NOT NULL,
  masked_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'configured',
  last_test_status text,
  last_test_at timestamptz,
  last_error text,
  created_by_principal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_integration_credentials_scope_check CHECK (scope IN ('platform', 'tenant')),
  CONSTRAINT platform_integration_credentials_status_check CHECK (status IN ('configured', 'invalid', 'revoked'))
);

CREATE TABLE IF NOT EXISTS platform_integration_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES platform_integration_providers(id) ON DELETE CASCADE,
  tenant_id text REFERENCES tenant_registry.tenants(tenant_id) ON DELETE CASCADE,
  status text NOT NULL,
  latency_ms integer,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES platform_integration_providers(id) ON DELETE SET NULL,
  credential_id uuid REFERENCES platform_integration_credentials(id) ON DELETE SET NULL,
  tenant_id text REFERENCES tenant_registry.tenants(tenant_id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_principal_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_provider_resilience_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL UNIQUE REFERENCES platform_integration_providers(id) ON DELETE CASCADE,
  timeout_ms integer NOT NULL DEFAULT 5000,
  retry_count integer NOT NULL DEFAULT 2,
  retry_backoff_ms integer NOT NULL DEFAULT 500,
  circuit_breaker_enabled boolean NOT NULL DEFAULT true,
  circuit_breaker_failure_threshold integer NOT NULL DEFAULT 5,
  circuit_breaker_cooldown_seconds integer NOT NULL DEFAULT 60,
  fallback_provider_key text,
  queue_on_failure boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_provider_resilience_timeout_check CHECK (timeout_ms BETWEEN 100 AND 120000),
  CONSTRAINT platform_provider_resilience_retry_count_check CHECK (retry_count BETWEEN 0 AND 10),
  CONSTRAINT platform_provider_resilience_retry_backoff_check CHECK (retry_backoff_ms BETWEEN 0 AND 60000),
  CONSTRAINT platform_provider_resilience_failure_threshold_check CHECK (circuit_breaker_failure_threshold BETWEEN 1 AND 100),
  CONSTRAINT platform_provider_resilience_cooldown_check CHECK (circuit_breaker_cooldown_seconds BETWEEN 1 AND 86400)
);

CREATE TABLE IF NOT EXISTS marketplace_sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id text NOT NULL UNIQUE,
  tenant_id text REFERENCES tenant_registry.tenants(tenant_id) ON DELETE SET NULL,
  owner_principal_id uuid,
  display_name text NOT NULL,
  legal_name text,
  seller_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  risk_status text NOT NULL DEFAULT 'normal',
  country text NOT NULL,
  currency text NOT NULL,
  tax_number text,
  phone text,
  email text,
  website text,
  onboarding_stage text NOT NULL DEFAULT 'application',
  approved_at timestamptz,
  rejected_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_sellers_status_check CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'suspended', 'archived')),
  CONSTRAINT marketplace_sellers_risk_status_check CHECK (risk_status IN ('normal', 'watch', 'high', 'blocked'))
);

CREATE TABLE IF NOT EXISTS marketplace_seller_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id text NOT NULL UNIQUE,
  tenant_id text REFERENCES tenant_registry.tenants(tenant_id) ON DELETE SET NULL,
  seller_id text REFERENCES marketplace_sellers(seller_id) ON DELETE SET NULL,
  applicant_principal_id uuid,
  display_name text NOT NULL,
  legal_name text NOT NULL,
  seller_type text NOT NULL,
  country text NOT NULL,
  email text NOT NULL,
  phone text,
  tax_number text,
  status text NOT NULL DEFAULT 'draft',
  review_status text NOT NULL DEFAULT 'not_started',
  review_notes text,
  reviewed_by_principal_id uuid,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  provider_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_seller_applications_status_check CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'cancelled')),
  CONSTRAINT marketplace_seller_applications_review_status_check CHECK (review_status IN ('not_started', 'pending', 'approved', 'rejected'))
);

CREATE TABLE IF NOT EXISTS marketplace_seller_kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id text REFERENCES marketplace_sellers(seller_id) ON DELETE SET NULL,
  application_id text REFERENCES marketplace_seller_applications(application_id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_status text NOT NULL DEFAULT 'pending',
  file_name text NOT NULL,
  file_mime_type text,
  file_size_bytes bigint,
  storage_key text,
  checksum text,
  rejection_reason text,
  reviewed_by_principal_id uuid,
  reviewed_at timestamptz,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_seller_kyc_documents_status_check CHECK (document_status IN ('pending', 'approved', 'rejected', 'expired', 'needs_update')),
  CONSTRAINT marketplace_seller_kyc_documents_file_size_check CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0)
);

CREATE TABLE IF NOT EXISTS marketplace_seller_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id text REFERENCES marketplace_sellers(seller_id) ON DELETE SET NULL,
  application_id text REFERENCES marketplace_seller_applications(application_id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_principal_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL UNIQUE,
  tenant_id text REFERENCES tenant_registry.tenants(tenant_id) ON DELETE SET NULL,
  seller_id text REFERENCES marketplace_sellers(seller_id) ON DELETE SET NULL,
  title text NOT NULL,
  subtitle text,
  description text,
  product_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  moderation_status text NOT NULL DEFAULT 'pending_review',
  sync_status text NOT NULL DEFAULT 'not_synced',
  country text NOT NULL,
  currency text NOT NULL,
  base_price_amount numeric(18, 4),
  tax_category text,
  sku text,
  barcode text,
  slug text,
  brand text,
  category_key text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  medusa_product_id text,
  created_by_principal_id uuid,
  approved_by_principal_id uuid,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_products_type_check CHECK (product_type IN ('physical', 'digital', 'service', 'subscription', 'bundle', 'auction', 'rental')),
  CONSTRAINT catalog_products_status_check CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  CONSTRAINT catalog_products_moderation_status_check CHECK (moderation_status IN ('pending_review', 'approved', 'rejected', 'needs_changes')),
  CONSTRAINT catalog_products_sync_status_check CHECK (sync_status IN ('not_synced', 'queued', 'syncing', 'synced', 'failed')),
  CONSTRAINT catalog_products_price_check CHECK (base_price_amount IS NULL OR base_price_amount >= 0)
);

CREATE TABLE IF NOT EXISTS catalog_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES catalog_products(product_id) ON DELETE CASCADE,
  variant_id text NOT NULL UNIQUE,
  title text NOT NULL,
  sku text,
  barcode text,
  price_amount numeric(18, 4),
  currency text,
  stock_quantity integer,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  medusa_variant_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_product_variants_price_check CHECK (price_amount IS NULL OR price_amount >= 0),
  CONSTRAINT catalog_product_variants_stock_check CHECK (stock_quantity IS NULL OR stock_quantity >= 0)
);

CREATE TABLE IF NOT EXISTS catalog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key text NOT NULL UNIQUE,
  parent_key text REFERENCES catalog_categories(category_key) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 0,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  medusa_category_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_categories_key_check CHECK (category_key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  CONSTRAINT catalog_categories_status_check CHECK (status IN ('active', 'inactive', 'archived'))
);

CREATE TABLE IF NOT EXISTS catalog_product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text REFERENCES catalog_products(product_id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_principal_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_medusa_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL UNIQUE,
  product_id text REFERENCES catalog_products(product_id) ON DELETE SET NULL,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_medusa_sync_jobs_status_check CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  CONSTRAINT catalog_medusa_sync_jobs_attempt_check CHECK (attempt_count >= 0)
);

CREATE TABLE IF NOT EXISTS commerce_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL UNIQUE,
  tenant_id text REFERENCES tenant_registry.tenants(tenant_id) ON DELETE SET NULL,
  seller_id text REFERENCES marketplace_sellers(seller_id) ON DELETE SET NULL,
  customer_id text,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  payment_status text NOT NULL DEFAULT 'unpaid',
  fulfillment_status text NOT NULL DEFAULT 'unfulfilled',
  risk_status text NOT NULL DEFAULT 'normal',
  currency text NOT NULL,
  subtotal_amount numeric(18, 4) NOT NULL DEFAULT 0,
  tax_amount numeric(18, 4) NOT NULL DEFAULT 0,
  shipping_amount numeric(18, 4) NOT NULL DEFAULT 0,
  discount_amount numeric(18, 4) NOT NULL DEFAULT 0,
  total_amount numeric(18, 4) NOT NULL DEFAULT 0,
  customer_email text,
  customer_phone text,
  billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  medusa_order_id text,
  created_by_principal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_orders_status_check CHECK (status IN ('draft', 'placed', 'confirmed', 'processing', 'completed', 'cancelled', 'archived')),
  CONSTRAINT commerce_orders_payment_status_check CHECK (payment_status IN ('unpaid', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed')),
  CONSTRAINT commerce_orders_fulfillment_status_check CHECK (fulfillment_status IN ('unfulfilled', 'partially_fulfilled', 'fulfilled', 'returned', 'cancelled')),
  CONSTRAINT commerce_orders_risk_status_check CHECK (risk_status IN ('normal', 'watch', 'high', 'blocked')),
  CONSTRAINT commerce_orders_amounts_check CHECK (
    subtotal_amount >= 0 AND tax_amount >= 0 AND shipping_amount >= 0 AND
    discount_amount >= 0 AND total_amount >= 0
  )
);

CREATE TABLE IF NOT EXISTS commerce_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES commerce_orders(order_id) ON DELETE CASCADE,
  item_id text NOT NULL UNIQUE,
  product_id text REFERENCES catalog_products(product_id) ON DELETE SET NULL,
  variant_id text REFERENCES catalog_product_variants(variant_id) ON DELETE SET NULL,
  seller_id text REFERENCES marketplace_sellers(seller_id) ON DELETE SET NULL,
  title text NOT NULL,
  sku text,
  quantity integer NOT NULL,
  unit_price_amount numeric(18, 4) NOT NULL,
  tax_amount numeric(18, 4) NOT NULL DEFAULT 0,
  discount_amount numeric(18, 4) NOT NULL DEFAULT 0,
  total_amount numeric(18, 4) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_order_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT commerce_order_items_amounts_check CHECK (
    unit_price_amount >= 0 AND tax_amount >= 0 AND discount_amount >= 0 AND total_amount >= 0
  )
);

CREATE TABLE IF NOT EXISTS commerce_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text REFERENCES commerce_orders(order_id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_principal_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commerce_order_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id text NOT NULL UNIQUE,
  order_id text NOT NULL REFERENCES commerce_orders(order_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'requested',
  reason text,
  requested_by_principal_id uuid,
  reviewed_by_principal_id uuid,
  reviewed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_order_returns_status_check CHECK (status IN ('requested', 'approved', 'rejected', 'received', 'completed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS commerce_order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id text NOT NULL UNIQUE,
  order_id text NOT NULL REFERENCES commerce_orders(order_id) ON DELETE CASCADE,
  return_id text REFERENCES commerce_order_returns(return_id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  amount numeric(18, 4) NOT NULL,
  currency text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_order_refunds_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'processed', 'failed')),
  CONSTRAINT commerce_order_refunds_amount_check CHECK (amount >= 0)
);

CREATE TABLE IF NOT EXISTS commerce_medusa_order_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL UNIQUE,
  order_id text REFERENCES commerce_orders(order_id) ON DELETE SET NULL,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_medusa_order_sync_jobs_status_check CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  CONSTRAINT commerce_medusa_order_sync_jobs_attempt_check CHECK (attempt_count >= 0)
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
CREATE INDEX IF NOT EXISTS platform_plugins_category_status_idx ON platform_plugins (category, status, is_enabled);
CREATE INDEX IF NOT EXISTS platform_plugin_settings_plugin_idx ON platform_plugin_settings (plugin_id, tenant_id);
CREATE INDEX IF NOT EXISTS platform_plugin_events_plugin_idx ON platform_plugin_events (plugin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_plugin_events_tenant_idx ON platform_plugin_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_integration_providers_category_status_idx ON platform_integration_providers (category, status, is_enabled);
CREATE INDEX IF NOT EXISTS platform_integration_credentials_provider_idx ON platform_integration_credentials (provider_id, tenant_id, status);
CREATE INDEX IF NOT EXISTS platform_integration_health_provider_idx ON platform_integration_health (provider_id, tenant_id, last_checked_at DESC);
CREATE INDEX IF NOT EXISTS platform_integration_events_provider_idx ON platform_integration_events (provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_integration_events_credential_idx ON platform_integration_events (credential_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_sellers_status_risk_idx ON marketplace_sellers (status, risk_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_sellers_tenant_idx ON marketplace_sellers (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_seller_applications_status_idx ON marketplace_seller_applications (status, review_status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_seller_applications_tenant_idx ON marketplace_seller_applications (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_seller_kyc_documents_application_idx ON marketplace_seller_kyc_documents (application_id, document_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_seller_kyc_documents_seller_idx ON marketplace_seller_kyc_documents (seller_id, document_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_seller_events_seller_idx ON marketplace_seller_events (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_seller_events_application_idx ON marketplace_seller_events (application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS catalog_products_status_idx ON catalog_products (status, moderation_status, sync_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS catalog_products_tenant_idx ON catalog_products (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS catalog_products_seller_idx ON catalog_products (seller_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS catalog_product_variants_product_idx ON catalog_product_variants (product_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS catalog_categories_parent_idx ON catalog_categories (parent_key, sort_order, name);
CREATE INDEX IF NOT EXISTS catalog_product_events_product_idx ON catalog_product_events (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS catalog_medusa_sync_jobs_product_idx ON catalog_medusa_sync_jobs (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS catalog_medusa_sync_jobs_status_idx ON catalog_medusa_sync_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS commerce_orders_status_idx ON commerce_orders (status, payment_status, fulfillment_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS commerce_orders_tenant_idx ON commerce_orders (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS commerce_orders_seller_idx ON commerce_orders (seller_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS commerce_order_items_order_idx ON commerce_order_items (order_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS commerce_order_items_product_idx ON commerce_order_items (product_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS commerce_order_events_order_idx ON commerce_order_events (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_order_returns_order_idx ON commerce_order_returns (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_order_returns_status_idx ON commerce_order_returns (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS commerce_order_refunds_order_idx ON commerce_order_refunds (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_order_refunds_status_idx ON commerce_order_refunds (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS commerce_medusa_order_sync_jobs_order_idx ON commerce_medusa_order_sync_jobs (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_medusa_order_sync_jobs_status_idx ON commerce_medusa_order_sync_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS platform_themes_industry_category_idx ON platform_themes (industry, category, status);
CREATE INDEX IF NOT EXISTS platform_theme_assignments_theme_idx ON platform_theme_assignments (theme_id, status);
CREATE INDEX IF NOT EXISTS platform_theme_events_tenant_idx ON platform_theme_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_theme_events_theme_idx ON platform_theme_events (theme_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_erp_bridge_engine_idx ON tenant_registry.tenant_erp_bridges (tenant_id, engine);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_commerce_bridge_engine_idx ON tenant_registry.tenant_commerce_bridges (tenant_id, engine);
