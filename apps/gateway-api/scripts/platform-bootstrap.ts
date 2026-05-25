import { createHash, pbkdf2Sync, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import pg from "pg";

const { Pool } = pg;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const directOnly = process.argv.includes("--direct") || process.env.COMMERCE_OS_BOOTSTRAP_IN_CONTAINER === "1";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hashPassword(password: string) {
  const iterations = 210_000;
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  return `pbkdf2-sha256$${iterations}$${salt}$${hash}`;
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
