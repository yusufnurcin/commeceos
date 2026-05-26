import { createHash, pbkdf2Sync, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import pg from "pg";
import type { PoolClient } from "pg";

const { Pool } = pg;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const directOnly = process.argv.includes("--direct") || process.env.COMMERCE_OS_BOOTSTRAP_IN_CONTAINER === "1";

const coreModules = [
  {
    key: "tenants",
    name: "Tenant Yönetimi",
    description: "Tenant registry, workspace provisioning ve tenant yaşam döngüsü.",
    category: "platform",
    enabled: true,
    dependencies: [],
    capabilities: ["tenant.registry", "tenant.provisioning", "workspace.registry"]
  },
  {
    key: "marketplace",
    name: "Marketplace",
    description: "Satıcı ekosistemi, mağaza denetimi ve marketplace operasyonları.",
    category: "marketplace",
    enabled: false,
    dependencies: ["tenants"],
    capabilities: ["seller.registry", "marketplace.governance"]
  },
  {
    key: "seller_kyc",
    name: "Satıcı KYC",
    description: "Satıcı belge, kimlik ve uygunluk denetimi.",
    category: "marketplace",
    enabled: false,
    dependencies: ["marketplace", "security"],
    capabilities: ["seller.kyc", "document.review"]
  },
  {
    key: "catalog",
    name: "Katalog",
    description: "Ürün, kategori, varyant ve attribute yönetimi.",
    category: "commerce",
    enabled: false,
    dependencies: ["medusa_commerce"],
    capabilities: ["catalog.products", "catalog.categories", "catalog.import"]
  },
  {
    key: "orders",
    name: "Siparişler",
    description: "Sipariş, iade, iptal ve fraud operasyonları.",
    category: "commerce",
    enabled: false,
    dependencies: ["medusa_commerce"],
    capabilities: ["orders.global", "returns", "refunds"]
  },
  {
    key: "payments",
    name: "Ödemeler",
    description: "Ödeme sağlayıcıları ve ödeme akışı ayarları.",
    category: "finance",
    enabled: false,
    dependencies: ["tenants"],
    capabilities: ["payments.providers", "payments.capture"]
  },
  {
    key: "wallets",
    name: "Cüzdanlar",
    description: "Satıcı, tenant, müşteri ve kurye bakiye yönetimi.",
    category: "finance",
    enabled: false,
    dependencies: ["payments"],
    capabilities: ["wallets.balance", "payouts.queue"]
  },
  {
    key: "accounting",
    name: "Muhasebe",
    description: "Muhasebe mapping, cari hesaplar ve Odoo accounting bağlantısı.",
    category: "accounting",
    enabled: false,
    dependencies: ["erp_odoo"],
    capabilities: ["accounting.mapping", "accounting.reports"]
  },
  {
    key: "tax",
    name: "Vergi",
    description: "Vergi oranları, vergi rejimleri ve bölgesel vergi kuralları.",
    category: "accounting",
    enabled: false,
    dependencies: ["accounting"],
    capabilities: ["tax.rules", "tax.regimes"]
  },
  {
    key: "invoicing",
    name: "Fatura",
    description: "Fatura merkezi ve muhasebe belge akışı.",
    category: "accounting",
    enabled: false,
    dependencies: ["accounting", "tax"],
    capabilities: ["invoices.issue", "invoices.sync"]
  },
  {
    key: "erp_odoo",
    name: "ERP / Odoo",
    description: "Odoo engine health, bridge jobs ve ERP bağlantı merkezi.",
    category: "erp",
    enabled: true,
    dependencies: ["tenants"],
    capabilities: ["odoo.health", "odoo.bridge_jobs"]
  },
  {
    key: "medusa_commerce",
    name: "Medusa Commerce",
    description: "Medusa health, orchestration jobs ve commerce engine bağlantısı.",
    category: "commerce",
    enabled: true,
    dependencies: ["tenants"],
    capabilities: ["medusa.health", "medusa.orchestration_jobs"]
  },
  {
    key: "logistics",
    name: "Lojistik",
    description: "Kargo, kurye, depo ve teslimat operasyonları.",
    category: "operations",
    enabled: false,
    dependencies: ["orders"],
    capabilities: ["shipments", "couriers", "warehouses"]
  },
  {
    key: "support",
    name: "Destek",
    description: "Ticket, canlı destek ve destek kanalları.",
    category: "support",
    enabled: false,
    dependencies: ["notifications"],
    capabilities: ["tickets", "support.channels"]
  },
  {
    key: "notifications",
    name: "Bildirimler",
    description: "E-posta, SMS, WhatsApp ve push bildirim hazırlığı.",
    category: "communications",
    enabled: false,
    dependencies: ["tenants"],
    capabilities: ["email", "sms", "whatsapp", "push"]
  },
  {
    key: "marketing",
    name: "Pazarlama",
    description: "Kampanya, kupon, reklam, loyalty ve affiliate operasyonları.",
    category: "growth",
    enabled: false,
    dependencies: [],
    capabilities: ["campaigns", "coupons", "ads", "loyalty"]
  },
  {
    key: "storefront_builder",
    name: "Storefront Builder",
    description: "Tema, sayfa, blok ve storefront düzenleme altyapısı.",
    category: "design",
    enabled: false,
    dependencies: ["themes"],
    capabilities: ["storefront.pages", "builder.blocks"]
  },
  {
    key: "cms",
    name: "CMS",
    description: "Sayfa, içerik, medya, SEO ve yayınlama altyapısı.",
    category: "content",
    enabled: false,
    dependencies: ["storefront_builder"],
    capabilities: ["cms.pages", "seo"]
  },
  {
    key: "ai",
    name: "AI Operasyonları",
    description: "AI sinyal, öneri ve operasyon yardımcı altyapısı.",
    category: "ai",
    enabled: true,
    dependencies: ["tenants"],
    capabilities: ["ai.signals", "ai.operations"]
  },
  {
    key: "security",
    name: "Güvenlik",
    description: "Rol, yetki, oturum, audit ve güvenlik denetimi.",
    category: "security",
    enabled: true,
    dependencies: [],
    capabilities: ["roles", "permissions", "sessions", "audit"]
  },
  {
    key: "integrations",
    name: "Entegrasyonlar",
    description: "API keys, webhooklar ve dış servis bağlantıları.",
    category: "integrations",
    enabled: false,
    dependencies: ["security"],
    capabilities: ["api_keys", "webhooks"]
  },
  {
    key: "reports",
    name: "Raporlama",
    description: "Operasyon, satış, finans ve sistem raporları.",
    category: "analytics",
    enabled: false,
    dependencies: ["tenants"],
    capabilities: ["reports.global", "exports"]
  },
  {
    key: "backup",
    name: "Yedekleme",
    description: "Tenant ve platform backup/restore operasyonları.",
    category: "system",
    enabled: false,
    dependencies: ["tenants"],
    capabilities: ["backup", "restore"]
  },
  {
    key: "localization",
    name: "Yerelleştirme",
    description: "Ülke, dil, para birimi, timezone ve bölgesel ayarlar.",
    category: "platform",
    enabled: true,
    dependencies: ["tenants"],
    capabilities: ["countries", "currencies", "languages"]
  },
  {
    key: "themes",
    name: "Temalar",
    description: "Tema registry, tema seçimi ve tenant tema hazırlığı.",
    category: "design",
    enabled: false,
    dependencies: [],
    capabilities: ["theme.registry", "theme.assignment"]
  },
  {
    key: "plugins",
    name: "Pluginler",
    description: "Plugin registry, upload, activation ve extension noktaları.",
    category: "extensions",
    enabled: false,
    dependencies: ["integrations"],
    capabilities: ["plugin.registry", "plugin.activation"]
  }
] as const;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hashPassword(password: string) {
  const iterations = 210_000;
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  return `pbkdf2-sha256$${iterations}$${salt}$${hash}`;
}

async function seedCoreModules(client: PoolClient) {
  for (const moduleDefinition of coreModules) {
    await client.query(
      `INSERT INTO platform_modules
        (key, name, description, category, status, version, installed_version, is_core, is_enabled,
         requires_license, license_status, dependencies, capabilities, settings_schema)
       VALUES ($1, $2, $3, $4, $5, '1.0.0', '1.0.0', true, $6, false, 'not_required', $7::jsonb, $8::jsonb, $9::jsonb)
       ON CONFLICT (key) DO UPDATE
       SET name = excluded.name,
           description = excluded.description,
           category = excluded.category,
           version = excluded.version,
           is_core = true,
           requires_license = excluded.requires_license,
           dependencies = excluded.dependencies,
           capabilities = excluded.capabilities,
           settings_schema = excluded.settings_schema,
           updated_at = now()`,
      [
        moduleDefinition.key,
        moduleDefinition.name,
        moduleDefinition.description,
        moduleDefinition.category,
        moduleDefinition.enabled ? "active" : "installed",
        moduleDefinition.enabled,
        JSON.stringify(moduleDefinition.dependencies),
        JSON.stringify(moduleDefinition.capabilities),
        JSON.stringify({
          type: "object",
          additionalProperties: true,
          moduleKey: moduleDefinition.key
        })
      ]
    );
  }
}

function loadInitSql(fileName: string) {
  const filePath = resolve(repoRoot, "infra/postgres/init", fileName);
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("\\connect"))
    .join("\n");
}

async function runBootstrap() {
  const pool = new Pool({
    connectionString:
      process.env.PLATFORM_POSTGRES_URL ??
      "postgres://commerce_os:commerce_os_dev_password@localhost:5432/commerce_os_gateway",
    max: 2,
    connectionTimeoutMillis: 1500,
    application_name: "commerce-os-platform-bootstrap"
  });

  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL ?? "admin@commerceos.local";
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "CommerceOS@2026!";
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME ?? "Commerce OS Super Admin";
  const allowDevCredentials = process.env.BOOTSTRAP_ALLOW_DEV_CREDENTIALS === "true";
  const usingDefaultPassword = adminPassword === "CommerceOS@2026!";
  const centralTenantId = "platform";
  const centralWorkspaceId = "central-admin";

  if (usingDefaultPassword && !allowDevCredentials) {
    throw new Error("BOOTSTRAP_ALLOW_DEV_CREDENTIALS=true is required for the development bootstrap password.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(loadInitSql("002-foundation-runtime-contracts.sql"));
    await client.query(loadInitSql("003-business-platform-core.sql"));
    await client.query(loadInitSql("004-operational-runtime.sql"));

    await client.query(
      `INSERT INTO tenant_registry.tenants
        (tenant_id, lifecycle_state, isolation_mode, default_locale, default_currency, display_name, country_code, timezone)
       VALUES ($1, 'active', 'schema-per-tenant', 'tr-TR', 'TRY', 'Commerce OS Platform', 'TR', 'Europe/Istanbul')
       ON CONFLICT (tenant_id) DO UPDATE
       SET updated_at = now(),
           display_name = COALESCE(tenant_registry.tenants.display_name, excluded.display_name),
           country_code = COALESCE(tenant_registry.tenants.country_code, excluded.country_code),
           timezone = COALESCE(tenant_registry.tenants.timezone, excluded.timezone)`,
      [centralTenantId]
    );

    await client.query(
      `INSERT INTO tenant_registry.tenant_workspaces (tenant_id, workspace_id, workspace_type, enabled, role_ids)
       VALUES ($1, $2, 'central-admin', true, ARRAY['super_admin'])
       ON CONFLICT (tenant_id, workspace_id) DO UPDATE SET enabled = true`,
      [centralTenantId, centralWorkspaceId]
    );

    await client.query(
      `INSERT INTO tenant_registry.workspaces (workspace_id, tenant_id, workspace_type, isolated_by_tenant)
       VALUES ($1, $2, 'central-admin', false)
       ON CONFLICT (workspace_id) DO UPDATE SET tenant_id = excluded.tenant_id, workspace_type = excluded.workspace_type`,
      [centralWorkspaceId, centralTenantId]
    );

    await client.query(
      `INSERT INTO tenant_isolation.isolation_plans
        (tenant_id, isolation_mode, data_residency_mode, postgres_schema, redis_key_prefix, minio_bucket_prefix,
         meilisearch_index_prefix, cache_namespace, queue_namespace, event_namespace, storage_namespace, erp_plan)
       VALUES
        ($1, 'schema-per-tenant', 'country-bound', 'tenant_platform', 'tenant:platform', 'tenant-platform',
         'tenant_platform', 'cache:tenant:platform', 'queue:tenant:platform', 'event:tenant:platform',
         'storage/tenant/platform', '{}'::jsonb)
       ON CONFLICT (tenant_id) DO UPDATE
       SET cache_namespace = excluded.cache_namespace,
           queue_namespace = excluded.queue_namespace,
           event_namespace = excluded.event_namespace,
           storage_namespace = excluded.storage_namespace`,
      [centralTenantId]
    );

    const existingPrincipal = await client.query<{ principal_id: string }>(
      `SELECT principal_id FROM auth_core.principals WHERE lower(email) = lower($1) LIMIT 1`,
      [adminEmail]
    );

    let principalId = existingPrincipal.rows[0]?.principal_id;
    let principalCreated = false;
    let credentialCreated = false;

    if (!principalId) {
      const inserted = await client.query<{ principal_id: string }>(
        `INSERT INTO auth_core.principals
          (principal_type, email, display_name, email_verified_at, status)
         VALUES ('platform-operator', $1, $2, now(), 'active')
         RETURNING principal_id`,
        [adminEmail, adminName]
      );
      principalId = inserted.rows[0]?.principal_id;
      principalCreated = true;
    } else {
      await client.query(
        `UPDATE auth_core.principals
         SET display_name = COALESCE(display_name, $2),
             email_verified_at = COALESCE(email_verified_at, now()),
             status = CASE WHEN status = 'pending_verification' THEN 'active' ELSE status END
         WHERE principal_id = $1`,
        [principalId, adminName]
      );
    }

    if (!principalId) {
      throw new Error("bootstrap_principal_create_failed");
    }

    const credential = await client.query(
      `SELECT credential_id FROM auth_core.password_credentials WHERE principal_id = $1 LIMIT 1`,
      [principalId]
    );

    if (credential.rowCount === 0) {
      await client.query(
        `INSERT INTO auth_core.password_credentials (principal_id, password_hash, password_hash_algorithm)
         VALUES ($1, $2, 'pbkdf2-sha256')`,
        [principalId, hashPassword(adminPassword)]
      );
      credentialCreated = true;
    }

    await client.query(
      `INSERT INTO auth_core.workspace_access_grants
        (principal_id, tenant_id, workspace_id, role_ids, permission_ids)
       SELECT $1::uuid, $2, $3, ARRAY['super_admin'], ARRAY['*','runtime.read','tenant.create','tenant.read','audit.read','session.manage']
       WHERE NOT EXISTS (
         SELECT 1
         FROM auth_core.workspace_access_grants
         WHERE principal_id = $1::uuid AND tenant_id = $2 AND workspace_id = $3
       )`,
      [principalId, centralTenantId, centralWorkspaceId]
    );

    await seedCoreModules(client);

    await client.query(
      `INSERT INTO operational_audit.audit_events
        (tenant_id, workspace_id, actor_id, actor_type, action, resource, result, payload, correlation_id, trace_id)
       VALUES ($1, $2, $3, 'system', 'platform.bootstrap', 'first-access', 'accepted', $4::jsonb, $5, $6)`,
      [
        centralTenantId,
        centralWorkspaceId,
        principalId,
        {
          adminEmailHash: sha256(adminEmail),
          principalCreated,
          credentialCreated,
          passwordChanged: credentialCreated
        },
        "platform-bootstrap",
        "platform-bootstrap"
      ]
    );

    await client.query("COMMIT");
    console.log(
      JSON.stringify(
        {
          status: "ok",
          schemasReady: ["auth_core", "tenant_registry", "workspace_runtime", "operational_audit", "event_core"],
          admin: {
            email: adminEmail,
            role: "super_admin",
            tenant: centralTenantId,
            workspace: centralWorkspaceId,
            principalCreated,
            passwordChanged: credentialCreated
          }
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  try {
    await runBootstrap();
  } catch (error) {
    if (!directOnly && existsSync(resolve(repoRoot, "docker-compose.yml"))) {
      const result = spawnSync(
        "docker",
        [
          "compose",
          "--project-directory",
          repoRoot,
          "exec",
          "-T",
          "-e",
          "COMMERCE_OS_BOOTSTRAP_IN_CONTAINER=1",
          "gateway-api",
          "pnpm",
          "--filter",
          "@commerce-os/gateway-api",
          "platform:bootstrap:direct"
        ],
        { cwd: repoRoot, stdio: "inherit", shell: process.platform === "win32" }
      );

      if (result.status === 0) {
        return;
      }
    }

    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

await main();
