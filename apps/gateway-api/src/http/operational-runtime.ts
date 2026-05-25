import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import {
  DEVICE_ID_HEADER,
  SESSION_FINGERPRINT_HEADER,
  defaultSecureCookieStrategy
} from "@commerce-os/auth-core";
import {
  medusaCommerceCoreContract,
  odooBridgeCoreContract,
  type MedusaOrchestrationOperation,
  type OdooBridgeOperation
} from "@commerce-os/commerce-core";
import {
  defaultDeadLetterQueue,
  defaultEventContracts,
  defaultEventReplay,
  defaultRealtimeSubscriptions,
  defaultRetryPolicy
} from "@commerce-os/sync-core";
import {
  createTenantIsolationPlan,
  tenantMiddlewareScopes,
  workspaceIsolationContracts,
  workspaceTypes,
  type WorkspaceType
} from "@commerce-os/tenant-core";
import type { GatewayEnvironment } from "../config/env";
import { randomToken, sha256, signAccessToken, verifyPassword } from "../runtime/crypto";
import type { RuntimeDatabase, RuntimeDatabaseClient } from "../runtime/db";
import { isRuntimeStoreUnavailable } from "../runtime/db";
import type { RequestContext } from "../runtime/request-context";
import type { ServiceRegistryEntry } from "../runtime/service-registry";
import type { VerifiedAuthContext } from "../runtime/auth-verifier";
import { asString, asStringArray } from "./request-body";
import { createRuntimeTopologyPayload, queueTopology } from "./topology";

type JsonRecord = Record<string, unknown>;

export interface OperationalRouteInput {
  readonly request: IncomingMessage;
  readonly method: string | undefined;
  readonly pathname: string;
  readonly context: RequestContext;
  readonly auth: VerifiedAuthContext;
  readonly env: GatewayEnvironment;
  readonly db: RuntimeDatabase;
  readonly registry: readonly ServiceRegistryEntry[];
  readonly body: JsonRecord;
}

export interface OperationalRouteResult {
  readonly statusCode: number;
  readonly payload: unknown;
}

interface PrincipalRow {
  readonly principal_id: string;
  readonly principal_type: string;
  readonly email: string | null;
  readonly email_verified_at: Date | string | null;
  readonly status: string;
}

interface PasswordCredentialRow {
  readonly credential_id: string;
  readonly password_hash: string;
  readonly password_hash_algorithm: string;
}

interface WorkspaceGrantRow {
  readonly role_ids: readonly string[];
  readonly permission_ids: readonly string[];
}

interface RefreshTokenRow {
  readonly token_id: string;
  readonly family_id: string;
  readonly principal_id: string;
  readonly principal_type: string;
  readonly tenant_id: string;
  readonly workspace_id: string;
  readonly device_id: string | null;
  readonly session_fingerprint_hash: string;
  readonly mfa_verified: boolean;
  readonly role_ids: readonly string[];
  readonly permission_ids: readonly string[];
  readonly used_at: Date | string | null;
  readonly revoked_at: Date | string | null;
  readonly expires_at: Date | string;
  readonly family_status: string;
}

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const publicAuthRuntimePaths = new Set([
  "/v1/auth/login",
  "/v1/auth/refresh",
  "/v1/auth/password-reset/request",
  "/v1/auth/password-reset/confirm",
  "/v1/auth/email-verification/confirm"
]);

function json(statusCode: number, payload: unknown): OperationalRouteResult {
  return { statusCode, payload };
}

function emptyOperationalState(resource: string, reason: string, extra: JsonRecord = {}) {
  return {
    state: "empty_operational_state",
    resource,
    reason,
    premiumEmptyState: {
      title: "Operasyon verisi bekleniyor",
      message: "Bu yüzey demo veri üretmez. Gerçek runtime sinyali geldiğinde otomatik olarak dolar.",
      action: "İlgili tenant, workspace veya engine olaylarını bağlayın."
    },
    ...extra
  };
}

function unauthorized(reasons: readonly string[]) {
  return json(401, {
    status: "auth_required",
    reasons
  });
}

function requireTenantWorkspace(context: RequestContext) {
  const reasons: string[] = [];
  if (!context.tenantId) {
    reasons.push("tenant_header_missing");
  }
  if (!context.workspaceId) {
    reasons.push("workspace_header_missing");
  }
  return reasons;
}

function requireProtected(input: OperationalRouteInput) {
  const reasons = requireTenantWorkspace(input.context);
  if (input.auth.status !== "valid") {
    reasons.push(...input.auth.reasons);
  }
  return reasons;
}

function getHeader(request: IncomingMessage, name: string) {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

async function writeAudit(
  db: RuntimeDatabase | RuntimeDatabaseClient,
  input: Pick<OperationalRouteInput, "context" | "auth">,
  action: string,
  result: string,
  payload: JsonRecord = {}
) {
  await db.query(
    `INSERT INTO operational_audit.audit_events
      (tenant_id, workspace_id, actor_id, actor_type, action, resource, result, payload, correlation_id, trace_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
    [
      input.context.tenantId ?? null,
      input.context.workspaceId ?? null,
      input.auth.principalId ?? "anonymous",
      input.auth.principalType ?? input.auth.mechanism ?? "anonymous",
      action,
      "gateway-runtime",
      result,
      payload,
      input.context.correlationId,
      input.context.traceId
    ]
  );
}

async function createOutboxEvent(
  db: RuntimeDatabaseClient,
  input: Pick<OperationalRouteInput, "context">,
  eventName: string,
  payload: JsonRecord,
  idempotencyKey: string
) {
  const eventId = randomUUID();
  await db.query(
    `INSERT INTO event_core.event_outbox
      (event_id, event_name, event_version, tenant_id, workspace_id, idempotency_key, correlation_id, trace_id, payload)
     VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
    [
      eventId,
      eventName,
      input.context.tenantId ?? "platform",
      input.context.workspaceId ?? null,
      idempotencyKey,
      input.context.correlationId,
      input.context.traceId,
      payload
    ]
  );
  return eventId;
}

function getClientFingerprint(input: OperationalRouteInput) {
  return (
    asString(input.body.sessionFingerprint) ??
    getHeader(input.request, SESSION_FINGERPRINT_HEADER) ??
    undefined
  );
}

function getDeviceFingerprint(input: OperationalRouteInput) {
  return (
    asString(input.body.deviceFingerprint) ??
    getHeader(input.request, DEVICE_ID_HEADER) ??
    getHeader(input.request, "user-agent") ??
    undefined
  );
}

async function issueSession(
  db: RuntimeDatabaseClient,
  input: OperationalRouteInput,
  principal: PrincipalRow,
  grant: WorkspaceGrantRow,
  mfaVerified: boolean,
  deviceId: string,
  sessionFingerprintHash: string
) {
  const family = await db.one<{ readonly family_id: string }>(
    `INSERT INTO auth_core.refresh_token_families
      (principal_id, tenant_id, workspace_id, device_id)
     VALUES ($1, $2, $3, $4)
     RETURNING family_id`,
    [principal.principal_id, input.context.tenantId ?? "", input.context.workspaceId ?? "", deviceId]
  );

  if (!family) {
    throw new Error("refresh_family_create_failed");
  }

  const refreshToken = randomToken();
  const refreshTokenHash = sha256(refreshToken);
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO auth_core.refresh_tokens (family_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [family.family_id, refreshTokenHash, refreshExpiresAt]
  );

  const session = await db.one<{ readonly session_id: string }>(
    `INSERT INTO auth_core.sessions
      (principal_id, tenant_id, workspace_id, refresh_token_family_id, session_fingerprint_hash, device_id, mfa_verified, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING session_id`,
    [
      principal.principal_id,
      input.context.tenantId ?? "",
      input.context.workspaceId ?? "",
      family.family_id,
      sessionFingerprintHash,
      deviceId,
      mfaVerified,
      new Date(Date.now() + 12 * 60 * 60 * 1000)
    ]
  );

  if (!session) {
    throw new Error("session_create_failed");
  }

  const access = signAccessToken(input.env, {
    sub: principal.principal_id,
    principal_type: principal.principal_type,
    tenant_id: input.context.tenantId ?? "",
    workspace_id: input.context.workspaceId ?? "",
    roles: grant.role_ids,
    permissions: grant.permission_ids,
    session_fingerprint_hash: sessionFingerprintHash,
    device_id: deviceId,
    mfa_verified: mfaVerified
  });

  return {
    accessToken: access.token,
    refreshToken,
    tokenType: "Bearer",
    expiresIn: access.payload.exp - access.payload.iat,
    refreshExpiresAt: refreshExpiresAt.toISOString(),
    sessionId: session.session_id,
    deviceId,
    secureCookie: defaultSecureCookieStrategy
  };
}

async function handleLogin(input: OperationalRouteInput) {
  const scopeErrors = requireTenantWorkspace(input.context);
  if (scopeErrors.length > 0) {
    return json(400, { status: "tenant_workspace_required", reasons: scopeErrors });
  }

  const email = asString(input.body.email)?.toLowerCase();
  const password = asString(input.body.password);
  const sessionFingerprint = getClientFingerprint(input);
  const deviceFingerprint = getDeviceFingerprint(input);
  if (!email || !password || !sessionFingerprint || !deviceFingerprint) {
    return json(400, {
      status: "login_contract_invalid",
      required: ["email", "password", SESSION_FINGERPRINT_HEADER, DEVICE_ID_HEADER]
    });
  }

  try {
    return await input.db.transaction(async (client) => {
      const principal = await client.one<PrincipalRow>(
        `SELECT principal_id, principal_type, email, email_verified_at, status
         FROM auth_core.principals
         WHERE lower(email) = lower($1)
         LIMIT 1`,
        [email]
      );

      const loginPayload = { emailHash: sha256(email), tenantId: input.context.tenantId, workspaceId: input.context.workspaceId };
      if (!principal || principal.status !== "active") {
        await writeAudit(client, input, "auth.login", "rejected", { ...loginPayload, reason: "principal_not_active" });
        return json(401, { status: "invalid_credentials" });
      }

      if (!principal.email_verified_at) {
        await writeAudit(client, input, "auth.login", "rejected", { ...loginPayload, reason: "email_not_verified" });
        return json(403, { status: "email_verification_required" });
      }

      const credential = await client.one<PasswordCredentialRow>(
        `SELECT credential_id, password_hash, password_hash_algorithm
         FROM auth_core.password_credentials
         WHERE principal_id = $1
         ORDER BY password_updated_at DESC
         LIMIT 1`,
        [principal.principal_id]
      );

      if (!credential || !verifyPassword(password, credential.password_hash, credential.password_hash_algorithm)) {
        await writeAudit(client, input, "auth.login", "rejected", { ...loginPayload, reason: "credential_mismatch" });
        return json(401, { status: "invalid_credentials" });
      }

      const grant = await client.one<WorkspaceGrantRow>(
        `SELECT role_ids, permission_ids
         FROM auth_core.workspace_access_grants
         WHERE principal_id = $1 AND tenant_id = $2 AND workspace_id = $3
           AND (expires_at IS NULL OR expires_at > now())
         LIMIT 1`,
        [principal.principal_id, input.context.tenantId ?? "", input.context.workspaceId ?? ""]
      );

      if (!grant) {
        await writeAudit(client, input, "auth.login", "rejected", { ...loginPayload, reason: "workspace_access_missing" });
        return json(403, { status: "workspace_access_denied" });
      }

      const deviceHash = sha256(deviceFingerprint);
      const device = await client.one<{ readonly device_id: string; readonly trust_state: string }>(
        `INSERT INTO auth_core.devices (principal_id, tenant_id, device_fingerprint_hash, last_seen_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (principal_id, device_fingerprint_hash)
         DO UPDATE SET last_seen_at = now()
         RETURNING device_id, trust_state`,
        [principal.principal_id, input.context.tenantId ?? "", deviceHash]
      );

      if (!device || device.trust_state === "revoked") {
        await writeAudit(client, input, "auth.login", "rejected", { ...loginPayload, reason: "device_revoked" });
        return json(403, { status: "device_revoked" });
      }

      const verifiedFactors = await client.query<{ readonly factor_id: string }>(
        `SELECT factor_id FROM auth_core.mfa_factors
         WHERE principal_id = $1 AND verified_at IS NOT NULL AND revoked_at IS NULL`,
        [principal.principal_id]
      );

      if (verifiedFactors.length > 0) {
        const challenge = randomToken(24);
        await client.query(
          `INSERT INTO auth_core.mfa_challenges
            (principal_id, tenant_id, workspace_id, challenge_hash, required_reason, expires_at)
           VALUES ($1, $2, $3, $4, 'login_mfa_required', $5)`,
          [
            principal.principal_id,
            input.context.tenantId ?? "",
            input.context.workspaceId ?? "",
            sha256(challenge),
            new Date(Date.now() + 5 * 60 * 1000)
          ]
        );
        await writeAudit(client, input, "auth.login", "challenged", loginPayload);
        return json(202, {
          status: "mfa_required",
          challengeToken: challenge,
          expiresIn: 300
        });
      }

      const tokenPayload = await issueSession(
        client,
        input,
        principal,
        grant,
        false,
        device.device_id,
        sha256(sessionFingerprint)
      );
      await writeAudit(client, input, "auth.login", "accepted", loginPayload);
      return json(200, { status: "ok", ...tokenPayload });
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "auth.login" });
    }
    throw error;
  }
}

async function handleRefresh(input: OperationalRouteInput) {
  const scopeErrors = requireTenantWorkspace(input.context);
  const refreshToken = asString(input.body.refreshToken);
  if (scopeErrors.length > 0 || !refreshToken) {
    return json(400, { status: "refresh_contract_invalid", reasons: scopeErrors, required: ["refreshToken"] });
  }

  try {
    return await input.db.transaction(async (client) => {
      const tokenHash = sha256(refreshToken);
      const row = await client.one<RefreshTokenRow>(
        `SELECT rt.token_id, rt.family_id, rt.used_at, rt.revoked_at, rt.expires_at,
                rtf.status AS family_status, rtf.principal_id, rtf.tenant_id, rtf.workspace_id, rtf.device_id,
                s.session_fingerprint_hash, s.mfa_verified,
                p.principal_type,
                COALESCE(wag.role_ids, ARRAY[]::text[]) AS role_ids,
                COALESCE(wag.permission_ids, ARRAY[]::text[]) AS permission_ids
         FROM auth_core.refresh_tokens rt
         JOIN auth_core.refresh_token_families rtf ON rtf.family_id = rt.family_id
         JOIN auth_core.principals p ON p.principal_id = rtf.principal_id
         JOIN auth_core.sessions s ON s.refresh_token_family_id = rtf.family_id AND s.status = 'active'
         LEFT JOIN auth_core.workspace_access_grants wag
           ON wag.principal_id = rtf.principal_id AND wag.tenant_id = rtf.tenant_id AND wag.workspace_id = rtf.workspace_id
         WHERE rt.token_hash = $1
         LIMIT 1`,
        [tokenHash]
      );

      if (!row || row.tenant_id !== input.context.tenantId || row.workspace_id !== input.context.workspaceId) {
        return json(401, { status: "refresh_rejected" });
      }

      if (row.family_status !== "active" || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) {
        return json(401, { status: "refresh_rejected" });
      }

      if (row.used_at) {
        await client.query(
          `UPDATE auth_core.refresh_token_families
           SET status = 'reused', revoked_at = now()
           WHERE family_id = $1`,
          [row.family_id]
        );
        return json(401, { status: "refresh_reuse_detected" });
      }

      const nextRefreshToken = randomToken();
      const nextRefreshTokenHash = sha256(nextRefreshToken);
      const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await client.query(`UPDATE auth_core.refresh_tokens SET used_at = now() WHERE token_id = $1`, [row.token_id]);
      await client.query(
        `INSERT INTO auth_core.refresh_tokens (family_id, token_hash, previous_token_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [row.family_id, nextRefreshTokenHash, row.token_id, refreshExpiresAt]
      );

      const access = signAccessToken(input.env, {
        sub: row.principal_id,
        principal_type: row.principal_type,
        tenant_id: row.tenant_id,
        workspace_id: row.workspace_id,
        roles: row.role_ids,
        permissions: row.permission_ids,
        session_fingerprint_hash: row.session_fingerprint_hash,
        device_id: row.device_id ?? "",
        mfa_verified: row.mfa_verified
      });

      await writeAudit(client, input, "auth.refresh", "accepted", { principalId: row.principal_id });
      return json(200, {
        status: "ok",
        accessToken: access.token,
        refreshToken: nextRefreshToken,
        tokenType: "Bearer",
        expiresIn: access.payload.exp - access.payload.iat,
        refreshExpiresAt: refreshExpiresAt.toISOString()
      });
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "auth.refresh" });
    }
    throw error;
  }
}

async function handleLogout(input: OperationalRouteInput) {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  const sessionId = asString(input.body.sessionId);
  try {
    await input.db.query(
      `UPDATE auth_core.sessions
       SET status = 'revoked', revoked_at = now()
       WHERE principal_id = $1 AND tenant_id = $2 AND workspace_id = $3
         AND ($4::uuid IS NULL OR session_id = $4::uuid)`,
      [input.auth.principalId ?? "", input.context.tenantId ?? "", input.context.workspaceId ?? "", sessionId ?? null]
    );
    await writeAudit(input.db, input, "auth.logout", "accepted", { sessionId: sessionId ?? "current_scope" });
    return json(200, { status: "ok" });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "auth.logout" });
    }
    throw error;
  }
}

async function handleMe(input: OperationalRouteInput) {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  return json(200, {
    status: "ok",
    principal: {
      principalId: input.auth.principalId,
      principalType: input.auth.principalType,
      tenantId: input.context.tenantId,
      workspaceId: input.context.workspaceId,
      roles: input.auth.roles,
      permissions: input.auth.permissions,
      mfaVerified: input.auth.mfaVerified
    },
    realtimeAuthState: {
      channel: `tenant:${input.context.tenantId}:workspace:${input.context.workspaceId}:auth`,
      isolated: true
    }
  });
}

async function handleSessions(input: OperationalRouteInput) {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  try {
    const rows = await input.db.query(
      `SELECT session_id, tenant_id, workspace_id, device_id, mfa_verified, status, issued_at, expires_at, revoked_at
       FROM auth_core.sessions
       WHERE principal_id = $1 AND tenant_id = $2 AND workspace_id = $3
       ORDER BY issued_at DESC
       LIMIT 50`,
      [input.auth.principalId ?? "", input.context.tenantId ?? "", input.context.workspaceId ?? ""]
    );
    return json(200, {
      status: "ok",
      sessions: rows,
      emptyState: rows.length === 0 ? emptyOperationalState("auth.sessions", "active_session_not_found") : undefined
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(200, emptyOperationalState("auth.sessions", "runtime_store_unavailable", { status: "store_unavailable" }));
    }
    throw error;
  }
}

async function handleSessionRevoke(input: OperationalRouteInput) {
  const reasons = requireProtected(input);
  const sessionId = asString(input.body.sessionId);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }
  if (!sessionId) {
    return json(400, { status: "session_id_required" });
  }

  try {
    await input.db.query(
      `UPDATE auth_core.sessions
       SET status = 'revoked', revoked_at = now()
       WHERE session_id = $1 AND principal_id = $2 AND tenant_id = $3 AND workspace_id = $4`,
      [sessionId, input.auth.principalId ?? "", input.context.tenantId ?? "", input.context.workspaceId ?? ""]
    );
    await writeAudit(input.db, input, "auth.session.revoke", "accepted", { sessionId });
    return json(200, { status: "ok" });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "auth.session.revoke" });
    }
    throw error;
  }
}

async function handleActivity(input: OperationalRouteInput) {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  try {
    const rows = await input.db.query(
      `SELECT login_activity_id, tenant_id, workspace_id, device_id, result, risk_level, occurred_at
       FROM auth_core.login_activity
       WHERE principal_id = $1 AND tenant_id = $2 AND workspace_id = $3
       ORDER BY occurred_at DESC
       LIMIT 50`,
      [input.auth.principalId ?? "", input.context.tenantId ?? "", input.context.workspaceId ?? ""]
    );
    return json(200, {
      status: "ok",
      activity: rows,
      suspiciousActivity: rows.filter((row) => {
        const value = row as { readonly risk_level?: string };
        return value.risk_level === "high" || value.risk_level === "blocked";
      }),
      emptyState: rows.length === 0 ? emptyOperationalState("auth.activity", "activity_not_found") : undefined
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(200, emptyOperationalState("auth.activity", "runtime_store_unavailable", { status: "store_unavailable" }));
    }
    throw error;
  }
}

async function handlePasswordResetRequest(input: OperationalRouteInput) {
  const email = asString(input.body.email)?.toLowerCase();
  if (!email) {
    return json(400, { status: "email_required" });
  }

  try {
    const token = randomToken(32);
    await input.db.query(
      `INSERT INTO auth_core.password_reset_requests (email_hash, token_hash, expires_at, requested_ip_hash, user_agent_hash)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        sha256(email),
        sha256(token),
        new Date(Date.now() + 30 * 60 * 1000),
        sha256(getHeader(input.request, "x-forwarded-for") ?? "unknown"),
        sha256(getHeader(input.request, "user-agent") ?? "unknown")
      ]
    );
    return json(202, {
      status: "accepted",
      delivery: "notification_adapter_required",
      message: "Parola sıfırlama olayı kaydedildi; token API cevabında sızdırılmaz."
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "auth.password_reset.request" });
    }
    throw error;
  }
}

async function handleTenantCreate(input: OperationalRouteInput) {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  const tenantId = asString(input.body.tenantId);
  const brandName = asString(input.body.brandName);
  const defaultLocale = asString(input.body.defaultLocale) ?? "tr-TR";
  const defaultCurrency = asString(input.body.defaultCurrency) ?? "TRY";
  const timezone = asString(input.body.timezone) ?? "Europe/Istanbul";
  const requestedWorkspaces = asStringArray(input.body.workspaces) ?? workspaceTypes;
  const invalidWorkspace = requestedWorkspaces.find((workspace) => !workspaceTypes.includes(workspace as WorkspaceType));
  if (!tenantId || !brandName || invalidWorkspace) {
    return json(400, {
      status: "tenant_onboarding_contract_invalid",
      required: ["tenantId", "brandName"],
      invalidWorkspace
    });
  }

  const isolationPlan = createTenantIsolationPlan(tenantId);
  const idempotencyKey = getHeader(input.request, defaultRetryPolicy.idempotencyKeyHeader) ?? `tenant-onboarding:${tenantId}`;
  const normalizedTenantId = tenantId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");

  try {
    return await input.db.transaction(async (client) => {
      await client.query(`CREATE SCHEMA IF NOT EXISTS tenant_${normalizedTenantId}`);
      await client.query(
        `INSERT INTO tenant_registry.tenants (tenant_id, lifecycle_state, isolation_mode, default_locale, default_currency)
         VALUES ($1, 'provisioning', $2, $3, $4)
         ON CONFLICT (tenant_id) DO UPDATE
         SET updated_at = now(), default_locale = excluded.default_locale, default_currency = excluded.default_currency`,
        [tenantId, isolationPlan.isolationMode, defaultLocale, defaultCurrency]
      );
      await client.query(
        `INSERT INTO tenant_isolation.isolation_plans
          (tenant_id, isolation_mode, data_residency_mode, postgres_schema, redis_key_prefix, minio_bucket_prefix,
           meilisearch_index_prefix, cache_namespace, queue_namespace, event_namespace, storage_namespace, erp_plan)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
         ON CONFLICT (tenant_id) DO UPDATE
         SET cache_namespace = excluded.cache_namespace,
             queue_namespace = excluded.queue_namespace,
             event_namespace = excluded.event_namespace,
             storage_namespace = excluded.storage_namespace`,
        [
          tenantId,
          isolationPlan.isolationMode,
          isolationPlan.dataResidencyMode,
          isolationPlan.postgresSchema ?? null,
          isolationPlan.redisKeyPrefix,
          isolationPlan.minioBucketPrefix,
          isolationPlan.meilisearchIndexPrefix,
          isolationPlan.cacheNamespace,
          isolationPlan.queueNamespace,
          isolationPlan.eventNamespace,
          isolationPlan.storageNamespace,
          { odooDatabase: `odoo_${normalizedTenantId}` }
        ]
      );
      await client.query(
        `INSERT INTO tenant_registry.tenant_branding (tenant_id, brand_name, color_tokens)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (tenant_id) DO UPDATE SET brand_name = excluded.brand_name, color_tokens = excluded.color_tokens`,
        [tenantId, brandName, input.body.colorTokens && typeof input.body.colorTokens === "object" ? input.body.colorTokens : {}]
      );
      await client.query(
        `INSERT INTO tenant_registry.tenant_locale_currency
          (tenant_id, default_locale, supported_locales, default_currency, supported_currencies, timezone)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id) DO UPDATE
         SET default_locale = excluded.default_locale,
             supported_locales = excluded.supported_locales,
             default_currency = excluded.default_currency,
             supported_currencies = excluded.supported_currencies,
             timezone = excluded.timezone`,
        [tenantId, defaultLocale, [defaultLocale], defaultCurrency, [defaultCurrency], timezone]
      );
      await client.query(
        `INSERT INTO tenant_registry.tenant_limits
          (tenant_id, max_workspaces, max_users, max_storage_gb, max_events_per_minute, max_queue_depth)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id) DO UPDATE
         SET max_workspaces = excluded.max_workspaces`,
        [tenantId, requestedWorkspaces.length, Number(input.body.maxUsers ?? 0), Number(input.body.maxStorageGb ?? 0), 0, 0]
      );

      for (const workspaceType of requestedWorkspaces) {
        await client.query(
          `INSERT INTO tenant_registry.tenant_workspaces (tenant_id, workspace_id, workspace_type, enabled, role_ids)
           VALUES ($1, $2, $3, true, $4)
           ON CONFLICT (tenant_id, workspace_id) DO UPDATE SET enabled = true, workspace_type = excluded.workspace_type`,
          [tenantId, `${tenantId}:${workspaceType}`, workspaceType, [`workspace.${workspaceType}.operator`]]
        );
      }

      await client.query(
        `INSERT INTO tenant_registry.tenant_erp_bridges (tenant_id, odoo_database, odoo_company_ids, raw_ui_allowed, enabled)
         VALUES ($1, $2, $3, false, true)
         ON CONFLICT DO NOTHING`,
        [tenantId, `odoo_${normalizedTenantId}`, []]
      );
      await client.query(
        `INSERT INTO tenant_registry.tenant_commerce_bridges (tenant_id, medusa_region_scope, admin_ui_allowed, enabled)
         VALUES ($1, $2, false, true)
         ON CONFLICT DO NOTHING`,
        [tenantId, `region_${normalizedTenantId}`]
      );

      const eventId = await createOutboxEvent(
        client,
        input,
        "workflow.command.accepted",
        { tenantId, workspaces: requestedWorkspaces, isolationPlan },
        idempotencyKey
      );
      await client.query(
        `INSERT INTO tenant_registry.tenant_lifecycle_events (tenant_id, from_state, to_state, reason, correlation_id)
         VALUES ($1, NULL, 'provisioning', 'tenant_onboarding_runtime_started', $2)`,
        [tenantId, input.context.correlationId]
      );
      await writeAudit(client, input, "tenant.onboarding.create", "accepted", { tenantId, eventId });

      return json(202, {
        status: "orchestration_started",
        tenantId,
        eventId,
        isolationPlan,
        tenantMiddlewareScopes,
        orchestrationFlow: [
          "tenant_registry",
          "workspace_provisioning",
          "isolated_namespace_creation",
          "branding_locale_currency",
          "odoo_bridge_provisioning",
          "medusa_bridge_provisioning",
          "storage_queue_cache_realtime_audit_namespace",
          "event_outbox"
        ]
      });
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "tenant.onboarding.create" });
    }
    throw error;
  }
}

async function handleTenantRegistry(input: OperationalRouteInput) {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  try {
    const tenants = await input.db.query(
      `SELECT tenant_id, lifecycle_state, isolation_mode, default_locale, default_currency, created_at, updated_at
       FROM tenant_registry.tenants
       ORDER BY updated_at DESC
       LIMIT 100`
    );
    return json(200, {
      status: "ok",
      tenants,
      emptyState: tenants.length === 0 ? emptyOperationalState("tenant.registry", "tenant_not_found") : undefined
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(200, emptyOperationalState("tenant.registry", "runtime_store_unavailable", { status: "store_unavailable" }));
    }
    throw error;
  }
}

async function handleWorkspaceRuntime(input: OperationalRouteInput) {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  try {
    const workspaces = await input.db.query(
      `SELECT workspace_id, workspace_type, enabled, role_ids
       FROM tenant_registry.tenant_workspaces
       WHERE tenant_id = $1
       ORDER BY workspace_type`,
      [input.context.tenantId ?? ""]
    );
    const activity = await input.db.query(
      `SELECT activity_id, workspace_id, activity_type, resource, result, occurred_at
       FROM workspace_runtime.activity_stream
       WHERE tenant_id = $1 AND ($2::text IS NULL OR workspace_id = $2)
       ORDER BY occurred_at DESC
       LIMIT 50`,
      [input.context.tenantId ?? "", input.context.workspaceId ?? null]
    );
    const notifications = await input.db.query(
      `SELECT notification_id, workspace_id, severity, title, read_at, created_at
       FROM workspace_runtime.notifications
       WHERE tenant_id = $1 AND ($2::text IS NULL OR workspace_id = $2)
       ORDER BY created_at DESC
       LIMIT 50`,
      [input.context.tenantId ?? "", input.context.workspaceId ?? null]
    );

    return json(200, {
      status: "ok",
      workspaceRegistry: workspaces,
      navigationGraph: workspaceIsolationContracts,
      commandSystem: workspaceIsolationContracts.map((workspace) => ({
        workspaceType: workspace.workspaceType,
        commandPrefix: workspace.commandPrefix,
        requiredPermissions: workspace.requiredPermissions
      })),
      realtimeChannels: defaultRealtimeSubscriptions.map((subscription) => ({
        ...subscription,
        tenantChannel: `tenant:${input.context.tenantId}:${subscription.channel}`,
        workspaceChannel: `tenant:${input.context.tenantId}:workspace:${input.context.workspaceId}:${subscription.channel}`
      })),
      activityStream: activity,
      notifications,
      layoutMemory: {
        persistenceTable: "workspace_runtime.layout_memory",
        required: true
      },
      emptyState:
        workspaces.length === 0 && activity.length === 0 && notifications.length === 0
          ? emptyOperationalState("workspace.runtime", "workspace_runtime_signal_not_found")
          : undefined
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(200, emptyOperationalState("workspace.runtime", "runtime_store_unavailable", { status: "store_unavailable" }));
    }
    throw error;
  }
}

async function handleControlCenter(input: OperationalRouteInput) {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  try {
    const [tenants, workspaces, queueStates, auditEvents, odooJobs, medusaJobs, aiSignals] = await Promise.all([
      input.db.query(`SELECT tenant_id, lifecycle_state, updated_at FROM tenant_registry.tenants ORDER BY updated_at DESC LIMIT 25`),
      input.db.query(`SELECT tenant_id, workspace_id, workspace_type, enabled FROM tenant_registry.tenant_workspaces ORDER BY tenant_id, workspace_type LIMIT 100`),
      input.db.query(`SELECT delivery_state, count(*)::int AS count FROM event_core.event_outbox GROUP BY delivery_state`),
      input.db.query(`SELECT action, result, occurred_at FROM operational_audit.audit_events ORDER BY occurred_at DESC LIMIT 25`),
      input.db.query(`SELECT operation, status, count(*)::int AS count FROM bridge_core.odoo_sync_jobs GROUP BY operation, status`),
      input.db.query(`SELECT operation, status, count(*)::int AS count FROM bridge_core.medusa_orchestration_jobs GROUP BY operation, status`),
      input.db.query(`SELECT signal_type, severity, status, created_at FROM ai_ops.operational_signals ORDER BY created_at DESC LIMIT 25`)
    ]);

    return json(200, {
      status: "ok",
      operationsCenter: {
        tenantTopologyMap: tenants,
        workspaceRegistry: workspaces,
        runtimeTopologyGraph: createRuntimeTopologyPayload(),
        syncTopologyGraph: queueTopology,
        realtimeEventStream: defaultRealtimeSubscriptions,
        queueMonitoring: queueStates,
        workerMonitoring: {
          persistenceTable: "workspace_runtime.worker_heartbeats",
          emptyState: emptyOperationalState("workers", "worker_heartbeat_not_found")
        },
        auditCenter: auditEvents,
        securityCenter: { authBoundary: "gateway-controlled", suspiciousActivityTable: "auth_core.suspicious_login_signals" },
        erpHealthCenter: odooJobs,
        commerceHealthCenter: medusaJobs,
        orchestrationCenter: {
          odoo: odooBridgeCoreContract.operations,
          medusa: medusaCommerceCoreContract.operations
        },
        aiOperationsCenter: {
          contracts: [
            "operational_recommendation",
            "sync_anomaly",
            "inventory_anomaly",
            "fraud_signal",
            "isolated_ai_context"
          ],
          signals: aiSignals
        },
        billingVisibility: {
          persistenceTable: "tenant_registry.tenant_limits",
          emptyState: emptyOperationalState("billing.visibility", "billing_meter_not_connected")
        },
        tenantLifecycleVisibility: tenants
      },
      emptyState:
        tenants.length === 0 && auditEvents.length === 0
          ? emptyOperationalState("control-center.operations", "runtime_signal_not_found")
          : undefined
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(200, {
        status: "store_unavailable",
        operationsCenter: {
          runtimeTopologyGraph: createRuntimeTopologyPayload(),
          realtimeEventStream: defaultRealtimeSubscriptions,
          orchestrationCenter: {
            odoo: odooBridgeCoreContract.operations,
            medusa: medusaCommerceCoreContract.operations
          }
        },
        emptyState: emptyOperationalState("control-center.operations", "runtime_store_unavailable")
      });
    }
    throw error;
  }
}

async function handleQueueRuntime(input: OperationalRouteInput) {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  try {
    const queueStates = await input.db.query(
      `SELECT event_name, delivery_state, count(*)::int AS count
       FROM event_core.event_outbox
       WHERE tenant_id = $1
       GROUP BY event_name, delivery_state
       ORDER BY event_name, delivery_state`,
      [input.context.tenantId ?? ""]
    );
    const deadLetters = await input.db.query(
      `SELECT event_name, failure_reason, created_at
       FROM event_core.event_dead_letters
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [input.context.tenantId ?? ""]
    );
    return json(200, {
      status: "ok",
      queueTopology,
      retryTopology: defaultRetryPolicy,
      deadLetterQueue: defaultDeadLetterQueue,
      queueStates,
      deadLetters,
      emptyState:
        queueStates.length === 0 && deadLetters.length === 0
          ? emptyOperationalState("queue.runtime", "queue_signal_not_found")
          : undefined
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(200, emptyOperationalState("queue.runtime", "runtime_store_unavailable", { status: "store_unavailable" }));
    }
    throw error;
  }
}

async function handleAuditRuntime(input: OperationalRouteInput) {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  try {
    const events = await input.db.query(
      `SELECT audit_id, tenant_id, workspace_id, actor_id, actor_type, action, result, occurred_at
       FROM operational_audit.audit_events
       WHERE ($1::text IS NULL OR tenant_id = $1)
         AND ($2::text IS NULL OR workspace_id = $2)
       ORDER BY occurred_at DESC
       LIMIT 100`,
      [input.context.tenantId ?? null, input.context.workspaceId ?? null]
    );
    return json(200, {
      status: "ok",
      auditTopology: {
        requestTracing: true,
        correlationIds: true,
        distributedTracing: "traceparent-compatible",
        tenantAudit: "operational_audit.audit_events",
        workspaceAudit: "operational_audit.audit_events",
        authAudit: "auth_core.auth_audit_events",
        orchestrationAudit: "bridge_core.*_jobs",
        syncAudit: "event_core.event_audit",
        erpAudit: "bridge_core.odoo_sync_jobs",
        commerceAudit: "bridge_core.medusa_orchestration_jobs"
      },
      events,
      emptyState: events.length === 0 ? emptyOperationalState("audit.runtime", "audit_event_not_found") : undefined
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(200, emptyOperationalState("audit.runtime", "runtime_store_unavailable", { status: "store_unavailable" }));
    }
    throw error;
  }
}

async function handleBridgeJob(input: OperationalRouteInput, bridge: "odoo" | "medusa") {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  const operation = asString(input.body.operation);
  const allowedOperations =
    bridge === "odoo"
      ? odooBridgeCoreContract.operations.map((item) => item.operation)
      : medusaCommerceCoreContract.operations.map((item) => item.operation);
  if (!operation || !allowedOperations.includes(operation as OdooBridgeOperation & MedusaOrchestrationOperation)) {
    return json(400, { status: "bridge_operation_invalid", allowedOperations });
  }

  const idempotencyKey = getHeader(input.request, defaultRetryPolicy.idempotencyKeyHeader) ?? `${bridge}:${operation}:${randomUUID()}`;
  const table = bridge === "odoo" ? "bridge_core.odoo_sync_jobs" : "bridge_core.medusa_orchestration_jobs";
  const idColumn = bridge === "odoo" ? "sync_job_id" : "orchestration_job_id";
  const eventName = bridge === "odoo" ? "erp.bridge.operation.requested" : "commerce.orchestration.requested";

  try {
    return await input.db.transaction(async (client) => {
      const job = await client.one<{ readonly job_id: string }>(
        `INSERT INTO ${table} (tenant_id, workspace_id, operation, idempotency_key, payload)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (tenant_id, idempotency_key) DO UPDATE SET payload = excluded.payload
         RETURNING ${idColumn} AS job_id`,
        [input.context.tenantId ?? "", input.context.workspaceId ?? "", operation, idempotencyKey, input.body.payload ?? {}]
      );
      const eventId = await createOutboxEvent(client, input, eventName, { bridge, operation, jobId: job?.job_id }, idempotencyKey);
      await writeAudit(client, input, `${bridge}.operation.request`, "accepted", { operation, jobId: job?.job_id, eventId });
      return json(202, {
        status: "orchestration_started",
        bridge,
        operation,
        jobId: job?.job_id,
        eventId,
        rawOdooUiAllowed: false,
        medusaAdminUiAllowed: false
      });
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: `${bridge}.operation.request` });
    }
    throw error;
  }
}

async function handleBridgeRuntime(input: OperationalRouteInput, bridge: "odoo" | "medusa") {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  const table = bridge === "odoo" ? "bridge_core.odoo_sync_jobs" : "bridge_core.medusa_orchestration_jobs";
  const contract = bridge === "odoo" ? odooBridgeCoreContract : medusaCommerceCoreContract;
  try {
    const jobs = await input.db.query(
      `SELECT operation, status, count(*)::int AS count
       FROM ${table}
       WHERE tenant_id = $1
       GROUP BY operation, status
       ORDER BY operation, status`,
      [input.context.tenantId ?? ""]
    );
    return json(200, {
      status: "ok",
      bridge,
      contract,
      jobs,
      emptyState: jobs.length === 0 ? emptyOperationalState(`${bridge}.runtime`, "bridge_job_not_found") : undefined
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(200, emptyOperationalState(`${bridge}.runtime`, "runtime_store_unavailable", { status: "store_unavailable" }));
    }
    throw error;
  }
}

async function handleAiOperations(input: OperationalRouteInput) {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  try {
    const signals = await input.db.query(
      `SELECT signal_id, signal_type, severity, status, subject_ref, created_at
       FROM ai_ops.operational_signals
       WHERE tenant_id = $1 AND ($2::text IS NULL OR workspace_id = $2)
       ORDER BY created_at DESC
       LIMIT 50`,
      [input.context.tenantId ?? "", input.context.workspaceId ?? null]
    );
    return json(200, {
      status: "ok",
      aiContracts: [
        "operational_recommendations",
        "anomaly_detection",
        "sync_anomaly",
        "inventory_anomaly",
        "fraud_signal",
        "operational_copilot",
        "ai_context_isolation",
        "ai_audit_visibility"
      ],
      contextIsolation: `ai:${input.context.tenantId}:${input.context.workspaceId}`,
      signals,
      emptyState: signals.length === 0 ? emptyOperationalState("ai.operations", "ai_signal_not_found") : undefined
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(200, emptyOperationalState("ai.operations", "runtime_store_unavailable", { status: "store_unavailable" }));
    }
    throw error;
  }
}

function handleRuntimeVerification(input: OperationalRouteInput) {
  return json(200, {
    status: "ok",
    runtimeVerification: {
      authRuntime: [
        "/v1/auth/login",
        "/v1/auth/logout",
        "/v1/auth/refresh",
        "/v1/auth/me",
        "/v1/auth/sessions",
        "/v1/auth/mfa/challenge",
        "/v1/auth/mfa/verify",
        "/v1/auth/activity"
      ],
      tenantRuntime: ["/v1/tenants", "/v1/tenants/registry"],
      workspaceRuntime: ["/v1/workspaces/runtime", "/v1/workspaces/registry"],
      realtimeChannels: defaultRealtimeSubscriptions,
      eventContracts: defaultEventContracts,
      retryTopology: defaultRetryPolicy,
      eventReplay: defaultEventReplay,
      tenantMiddlewareScopes,
      auditTopology: {
        requestTracing: true,
        correlationId: input.context.correlationId,
        traceId: input.context.traceId
      },
      orchestrationTopology: {
        odoo: odooBridgeCoreContract.operations,
        medusa: medusaCommerceCoreContract.operations
      },
      services: input.registry
    }
  });
}

export function isOperationalRuntimeRoute(pathname: string) {
  return (
    pathname.startsWith("/v1/auth/") ||
    pathname === "/v1/tenants" ||
    pathname === "/v1/tenants/registry" ||
    pathname === "/v1/workspaces/runtime" ||
    pathname === "/v1/workspaces/registry" ||
    pathname === "/v1/control-center/operations" ||
    pathname === "/v1/queues/runtime" ||
    pathname === "/v1/audit/runtime" ||
    pathname === "/v1/ai/operations" ||
    pathname === "/v1/runtime/verification" ||
    pathname === "/v1/bridges/odoo/runtime" ||
    pathname === "/v1/bridges/medusa/runtime" ||
    pathname === "/v1/bridges/odoo/sync" ||
    pathname === "/v1/bridges/medusa/orchestrate"
  );
}

export async function handleOperationalRoute(input: OperationalRouteInput): Promise<OperationalRouteResult> {
  if (input.method === "GET") {
    switch (input.pathname) {
      case "/v1/auth/me":
        return handleMe(input);
      case "/v1/auth/sessions":
        return handleSessions(input);
      case "/v1/auth/activity":
        return handleActivity(input);
      case "/v1/tenants/registry":
        return handleTenantRegistry(input);
      case "/v1/workspaces/runtime":
      case "/v1/workspaces/registry":
        return handleWorkspaceRuntime(input);
      case "/v1/control-center/operations":
        return handleControlCenter(input);
      case "/v1/queues/runtime":
        return handleQueueRuntime(input);
      case "/v1/audit/runtime":
        return handleAuditRuntime(input);
      case "/v1/ai/operations":
        return handleAiOperations(input);
      case "/v1/bridges/odoo/runtime":
        return handleBridgeRuntime(input, "odoo");
      case "/v1/bridges/medusa/runtime":
        return handleBridgeRuntime(input, "medusa");
      case "/v1/runtime/verification":
        return handleRuntimeVerification(input);
      default:
        break;
    }
  }

  if (mutationMethods.has(input.method ?? "")) {
    switch (input.pathname) {
      case "/v1/auth/login":
        return handleLogin(input);
      case "/v1/auth/refresh":
        return handleRefresh(input);
      case "/v1/auth/logout":
        return handleLogout(input);
      case "/v1/auth/sessions/revoke":
        return handleSessionRevoke(input);
      case "/v1/auth/password-reset/request":
        return handlePasswordResetRequest(input);
      case "/v1/tenants":
        return handleTenantCreate(input);
      case "/v1/bridges/odoo/sync":
        return handleBridgeJob(input, "odoo");
      case "/v1/bridges/medusa/orchestrate":
        return handleBridgeJob(input, "medusa");
      case "/v1/auth/mfa/challenge":
      case "/v1/auth/mfa/verify":
      case "/v1/auth/email-verification/request":
      case "/v1/auth/email-verification/confirm":
      case "/v1/auth/password-reset/confirm":
        return json(501, {
          status: "adapter_required",
          route: input.pathname,
          message: "Bu auth runtime yolu gerçek adapter ister; fake response üretilmedi."
        });
      default:
        break;
    }
  }

  return json(404, {
    status: "operational_route_not_found",
    path: input.pathname
  });
}
