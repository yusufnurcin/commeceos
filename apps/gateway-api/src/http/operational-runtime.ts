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
  readonly display_name: string | null;
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
  readonly session_id: string;
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

interface PlatformModuleRow {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly status: string;
  readonly version: string;
  readonly installed_version: string | null;
  readonly is_core: boolean;
  readonly is_enabled: boolean;
  readonly requires_license: boolean;
  readonly license_status: string;
  readonly dependencies: unknown;
  readonly capabilities: unknown;
  readonly settings_schema: unknown;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

interface PlatformModuleEventRow {
  readonly id: string;
  readonly module_id: string;
  readonly event_type: string;
  readonly actor_principal_id: string | null;
  readonly payload: unknown;
  readonly created_at: Date | string;
}

interface PlatformThemeRow {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly industry: string;
  readonly category: string;
  readonly status: string;
  readonly version: string;
  readonly is_core: boolean;
  readonly is_premium: boolean;
  readonly supports_dark_mode: boolean;
  readonly supports_mobile: boolean;
  readonly supports_rtl: boolean;
  readonly preview_image_url: string | null;
  readonly capabilities: unknown;
  readonly design_tokens: unknown;
  readonly layout_presets: unknown;
  readonly required_modules: unknown;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

interface PlatformThemeAssignmentRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly theme_id: string;
  readonly status: string;
  readonly assigned_by_principal_id: string | null;
  readonly activated_at: Date | string | null;
  readonly settings: unknown;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
  readonly theme_key?: string;
  readonly theme_name?: string;
  readonly theme_industry?: string;
  readonly theme_category?: string;
}

interface PlatformThemeEventRow {
  readonly id: string;
  readonly theme_id: string | null;
  readonly tenant_id: string | null;
  readonly event_type: string;
  readonly actor_principal_id: string | null;
  readonly payload: unknown;
  readonly created_at: Date | string;
}

interface PlatformPluginRow {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly status: string;
  readonly version: string;
  readonly installed_version: string | null;
  readonly provider: string;
  readonly source_type: string;
  readonly is_core: boolean;
  readonly is_enabled: boolean;
  readonly requires_license: boolean;
  readonly license_status: string;
  readonly required_modules: unknown;
  readonly permissions: unknown;
  readonly capabilities: unknown;
  readonly settings_schema: unknown;
  readonly install_manifest: unknown;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

interface PlatformPluginEventRow {
  readonly id: string;
  readonly plugin_id: string | null;
  readonly tenant_id: string | null;
  readonly event_type: string;
  readonly actor_principal_id: string | null;
  readonly payload: unknown;
  readonly created_at: Date | string;
}

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const moduleKeyPattern = /^[a-z0-9][a-z0-9_-]{1,63}$/;

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

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, `""`)}"`;
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

function isServicePrincipal(input: Pick<OperationalRouteInput, "auth">) {
  return input.auth.mechanism === "service-token";
}

async function requireSuperAdmin(input: OperationalRouteInput) {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  if (isServicePrincipal(input)) {
    return json(403, {
      status: "super_admin_required",
      reason: "service_principal_cannot_manage_user_scoped_modules"
    });
  }

  if (!input.auth.roles.includes("super_admin")) {
    return json(403, { status: "super_admin_required" });
  }

  if (!(await hasActiveJwtSession(input))) {
    return unauthorized(["session_inactive"]);
  }

  return null;
}

async function requireThemeAccess(input: OperationalRouteInput, tenantId?: string) {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  if (isServicePrincipal(input)) {
    return json(403, { status: "user_principal_required" });
  }

  const hasCentralAccess = input.auth.roles.includes("super_admin");
  const hasTenantAccess = input.auth.roles.includes("tenant_admin") && (!tenantId || input.context.tenantId === tenantId);
  if (!hasCentralAccess && !hasTenantAccess) {
    return json(403, { status: "theme_access_denied" });
  }

  if (!(await hasActiveJwtSession(input))) {
    return unauthorized(["session_inactive"]);
  }

  return null;
}

function servicePrincipalResponse(input: OperationalRouteInput) {
  return json(200, {
    status: "ok",
    principal: {
      principalId: input.auth.principalId,
      principalType: input.auth.principalType ?? "service-account",
      roles: input.auth.roles,
      permissions: input.auth.permissions,
      tenantId: input.context.tenantId,
      workspaceId: input.context.workspaceId
    },
    session: {
      status: "service_principal",
      message: "Service-token kalıcı kullanıcı oturumu üretmez."
    }
  });
}

function userSessionRequiredResponse() {
  return json(403, {
    status: "user_session_required",
    message: "Bu endpoint kalıcı kullanıcı oturumu ister; service-token için session listesi sorgulanmaz."
  });
}

async function hasActiveJwtSession(input: OperationalRouteInput) {
  if (input.auth.mechanism !== "jwt") {
    return true;
  }

  if (!input.auth.sessionId) {
    return false;
  }

  const session = await input.db.one<{ readonly session_id: string }>(
    `SELECT session_id
     FROM auth_core.sessions
     WHERE session_id = $1
       AND principal_id = $2
       AND tenant_id = $3
       AND workspace_id = $4
       AND status = 'active'
       AND expires_at > now()
     LIMIT 1`,
    [input.auth.sessionId, input.auth.principalId ?? "", input.context.tenantId ?? "", input.context.workspaceId ?? ""]
  );

  return Boolean(session);
}

function getHeader(request: IncomingMessage, name: string) {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getRemoteAddress(input: Pick<OperationalRouteInput, "request">) {
  return (
    getHeader(input.request, "x-forwarded-for")?.split(",")[0]?.trim() ??
    input.request.socket.remoteAddress ??
    "unknown"
  );
}

function getUserAgent(input: Pick<OperationalRouteInput, "request">) {
  return getHeader(input.request, "user-agent") ?? "unknown";
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

function actorPrincipalId(input: Pick<OperationalRouteInput, "auth">) {
  const principalId = input.auth.principalId;
  return principalId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(principalId)
    ? principalId
    : null;
}

async function writeModuleEvent(
  db: RuntimeDatabase | RuntimeDatabaseClient,
  input: OperationalRouteInput,
  moduleId: string,
  eventType: string,
  payload: JsonRecord = {}
) {
  await db.query(
    `INSERT INTO platform_module_events (module_id, event_type, actor_principal_id, payload)
     VALUES ($1, $2, $3::uuid, $4::jsonb)`,
    [moduleId, eventType, actorPrincipalId(input), payload]
  );
  await writeAudit(db, input, eventType, "accepted", {
    moduleId,
    ...payload
  });
}

async function writeThemeEvent(
  db: RuntimeDatabase | RuntimeDatabaseClient,
  input: OperationalRouteInput,
  eventType: string,
  payload: JsonRecord = {},
  scope: { readonly themeId?: string | null; readonly tenantId?: string | null } = {}
) {
  await db.query(
    `INSERT INTO platform_theme_events (theme_id, tenant_id, event_type, actor_principal_id, payload)
     VALUES ($1::uuid, $2, $3, $4::uuid, $5::jsonb)`,
    [scope.themeId ?? null, scope.tenantId ?? null, eventType, actorPrincipalId(input), payload]
  );
  await writeAudit(db, input, eventType, "accepted", {
    themeId: scope.themeId ?? null,
    tenantId: scope.tenantId ?? null,
    ...payload
  });
}

async function writePluginEvent(
  db: RuntimeDatabase | RuntimeDatabaseClient,
  input: OperationalRouteInput,
  eventType: string,
  payload: JsonRecord = {},
  scope: { readonly pluginId?: string | null; readonly tenantId?: string | null } = {}
) {
  await db.query(
    `INSERT INTO platform_plugin_events (plugin_id, tenant_id, event_type, actor_principal_id, payload)
     VALUES ($1::uuid, $2, $3, $4::uuid, $5::jsonb)`,
    [scope.pluginId ?? null, scope.tenantId ?? null, eventType, actorPrincipalId(input), payload]
  );
  await writeAudit(db, input, eventType, "accepted", {
    pluginId: scope.pluginId ?? null,
    tenantId: scope.tenantId ?? null,
    ...payload
  });
}

function jsonObject(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function moduleDependencies(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && moduleKeyPattern.test(item));
  }

  if (jsonObject(value) && Array.isArray((value as { readonly modules?: unknown }).modules)) {
    return (value as { readonly modules: readonly unknown[] }).modules.filter(
      (item): item is string => typeof item === "string" && moduleKeyPattern.test(item)
    );
  }

  return [];
}

function serializeModule(row: PlatformModuleRow) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    category: row.category,
    status: row.status,
    version: row.version,
    installedVersion: row.installed_version,
    isCore: row.is_core,
    isEnabled: row.is_enabled,
    requiresLicense: row.requires_license,
    licenseStatus: row.license_status,
    dependencies: moduleDependencies(row.dependencies),
    capabilities: row.capabilities,
    settingsSchema: row.settings_schema,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function themeRequiredModules(value: unknown) {
  return moduleDependencies(value);
}

function serializeTheme(row: PlatformThemeRow) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    industry: row.industry,
    category: row.category,
    status: row.status,
    version: row.version,
    isCore: row.is_core,
    isPremium: row.is_premium,
    supportsDarkMode: row.supports_dark_mode,
    supportsMobile: row.supports_mobile,
    supportsRtl: row.supports_rtl,
    previewImageUrl: row.preview_image_url,
    capabilities: row.capabilities,
    designTokens: row.design_tokens,
    layoutPresets: row.layout_presets,
    requiredModules: themeRequiredModules(row.required_modules),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function serializeThemeAssignment(row: PlatformThemeAssignmentRow | undefined) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    themeId: row.theme_id,
    status: row.status,
    assignedByPrincipalId: row.assigned_by_principal_id,
    activatedAt: row.activated_at,
    settings: row.settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    theme: row.theme_key
      ? {
          key: row.theme_key,
          name: row.theme_name,
          industry: row.theme_industry,
          category: row.theme_category
        }
      : undefined
  };
}

function pluginRequiredModules(value: unknown) {
  return moduleDependencies(value);
}

function pluginPermissions(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }
  return [];
}

function serializePlugin(row: PlatformPluginRow) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    category: row.category,
    status: row.status,
    version: row.version,
    installedVersion: row.installed_version,
    provider: row.provider,
    sourceType: row.source_type,
    isCore: row.is_core,
    isEnabled: row.is_enabled,
    requiresLicense: row.requires_license,
    licenseStatus: row.license_status,
    requiredModules: pluginRequiredModules(row.required_modules),
    permissions: pluginPermissions(row.permissions),
    capabilities: row.capabilities,
    settingsSchema: row.settings_schema,
    installManifest: row.install_manifest,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function writeLoginActivity(
  db: RuntimeDatabase | RuntimeDatabaseClient,
  input: Pick<OperationalRouteInput, "request" | "context">,
  principalId: string | null,
  deviceId: string | null,
  result: "accepted" | "challenged" | "rejected",
  riskLevel: "low" | "medium" | "high" | "blocked"
) {
  await db.query(
    `INSERT INTO auth_core.login_activity
      (principal_id, tenant_id, workspace_id, ip_hash, user_agent_hash, device_id, result, risk_level)
     VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid, $7, $8)`,
    [
      principalId,
      input.context.tenantId ?? null,
      input.context.workspaceId ?? null,
      sha256(getRemoteAddress(input)),
      sha256(getUserAgent(input)),
      deviceId,
      result,
      riskLevel
    ]
  );
}

async function createOutboxEvent(
  db: RuntimeDatabaseClient,
  input: Pick<OperationalRouteInput, "context">,
  eventName: string,
  payload: JsonRecord,
  idempotencyKey: string,
  scope: { readonly tenantId?: string; readonly workspaceId?: string | null } = {}
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
      scope.tenantId ?? input.context.tenantId ?? "platform",
      scope.workspaceId ?? input.context.workspaceId ?? null,
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
    session_id: session.session_id,
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
  const sessionFingerprint = getClientFingerprint(input) ?? randomToken(18);
  const deviceFingerprint = getDeviceFingerprint(input) ?? randomToken(18);
  if (!email || !password) {
    return json(400, {
      status: "login_contract_invalid",
      required: ["email", "password"]
    });
  }

  try {
    return await input.db.transaction(async (client) => {
      const principal = await client.one<PrincipalRow>(
        `SELECT principal_id, principal_type, email, display_name, email_verified_at, status
         FROM auth_core.principals
         WHERE lower(email) = lower($1)
         LIMIT 1`,
        [email]
      );

      const loginPayload = { emailHash: sha256(email), tenantId: input.context.tenantId, workspaceId: input.context.workspaceId };
      if (!principal || principal.status !== "active") {
        await writeLoginActivity(client, input, principal?.principal_id ?? null, null, "rejected", "medium");
        await writeAudit(client, input, "auth.login", "rejected", { ...loginPayload, reason: "principal_not_active" });
        return json(401, { status: "invalid_credentials" });
      }

      if (!principal.email_verified_at) {
        await writeLoginActivity(client, input, principal.principal_id, null, "rejected", "medium");
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
        await writeLoginActivity(client, input, principal.principal_id, null, "rejected", "medium");
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
        await writeLoginActivity(client, input, principal.principal_id, null, "rejected", "medium");
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
        await writeLoginActivity(client, input, principal.principal_id, device?.device_id ?? null, "rejected", "blocked");
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
        await writeLoginActivity(client, input, principal.principal_id, device.device_id, "challenged", "medium");
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
      await writeLoginActivity(client, input, principal.principal_id, device.device_id, "accepted", "low");
      await writeAudit(client, input, "auth.login", "accepted", loginPayload);
      return json(200, {
        status: "ok",
        principal: {
          principalId: principal.principal_id,
          email: principal.email,
          name: principal.display_name,
          roles: grant.role_ids,
          workspaceId: input.context.workspaceId,
          tenantId: input.context.tenantId
        },
        sessionFingerprint,
        ...tokenPayload
      });
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
        `SELECT rt.token_id, rt.family_id, s.session_id, rt.used_at, rt.revoked_at, rt.expires_at,
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
        session_id: row.session_id,
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

  if (input.auth.mechanism !== "jwt") {
    return unauthorized(["jwt_session_required"]);
  }

  const sessionId = asString(input.body.sessionId) ?? input.auth.sessionId;
  try {
    await input.db.transaction(async (client) => {
      const sessions = await client.query<{ readonly session_id: string; readonly refresh_token_family_id: string }>(
        `SELECT session_id, refresh_token_family_id
         FROM auth_core.sessions
         WHERE principal_id = $1 AND tenant_id = $2 AND workspace_id = $3
           AND ($4::uuid IS NULL OR session_id = $4::uuid)`,
        [input.auth.principalId ?? "", input.context.tenantId ?? "", input.context.workspaceId ?? "", sessionId ?? null]
      );
      const sessionIds = sessions.map((session) => session.session_id);
      const familyIds = sessions.map((session) => session.refresh_token_family_id);

      await client.query(
        `UPDATE auth_core.sessions
         SET status = 'revoked', revoked_at = now()
         WHERE session_id = ANY($1::uuid[])`,
        [sessionIds]
      );
      await client.query(
        `UPDATE auth_core.refresh_token_families
         SET status = 'revoked', revoked_at = now()
         WHERE family_id = ANY($1::uuid[])`,
        [familyIds]
      );
      await client.query(
        `UPDATE auth_core.refresh_tokens
         SET revoked_at = now()
         WHERE family_id = ANY($1::uuid[]) AND revoked_at IS NULL`,
        [familyIds]
      );
      await writeAudit(client, input, "auth.logout", "accepted", { sessionId: sessionId ?? "current_scope" });
    });
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

  if (isServicePrincipal(input)) {
    return servicePrincipalResponse(input);
  }

  try {
    if (!(await hasActiveJwtSession(input))) {
      return unauthorized(["session_inactive"]);
    }

    const principal = await input.db.one<{
      readonly email: string | null;
      readonly display_name: string | null;
      readonly status: string;
    }>(
      `SELECT email, display_name, status
       FROM auth_core.principals
       WHERE principal_id = $1
       LIMIT 1`,
      [input.auth.principalId ?? ""]
    );

    return json(200, {
      status: "ok",
      principal: {
        principalId: input.auth.principalId,
        principalType: input.auth.principalType,
        email: principal?.email,
        name: principal?.display_name,
        tenantId: input.context.tenantId,
        workspaceId: input.context.workspaceId,
        roles: input.auth.roles,
        permissions: input.auth.permissions,
        mfaVerified: input.auth.mfaVerified
      },
      session: {
        sessionId: input.auth.sessionId,
        status: "active",
        deviceId: input.auth.deviceId
      },
      realtimeAuthState: {
        channel: `tenant:${input.context.tenantId}:workspace:${input.context.workspaceId}:auth`,
        isolated: true
      }
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "auth.me" });
    }
    throw error;
  }
}

async function handleSessions(input: OperationalRouteInput) {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  if (isServicePrincipal(input)) {
    return userSessionRequiredResponse();
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
  if (isServicePrincipal(input)) {
    return userSessionRequiredResponse();
  }
  if (!sessionId) {
    return json(400, { status: "session_id_required" });
  }

  try {
    await input.db.transaction(async (client) => {
      const session = await client.one<{ readonly refresh_token_family_id: string }>(
        `SELECT refresh_token_family_id
         FROM auth_core.sessions
         WHERE session_id = $1 AND principal_id = $2 AND tenant_id = $3 AND workspace_id = $4
         LIMIT 1`,
        [sessionId, input.auth.principalId ?? "", input.context.tenantId ?? "", input.context.workspaceId ?? ""]
      );
      await client.query(
        `UPDATE auth_core.sessions
         SET status = 'revoked', revoked_at = now()
         WHERE session_id = $1 AND principal_id = $2 AND tenant_id = $3 AND workspace_id = $4`,
        [sessionId, input.auth.principalId ?? "", input.context.tenantId ?? "", input.context.workspaceId ?? ""]
      );
      if (session) {
        await client.query(
          `UPDATE auth_core.refresh_token_families
           SET status = 'revoked', revoked_at = now()
           WHERE family_id = $1`,
          [session.refresh_token_family_id]
        );
        await client.query(
          `UPDATE auth_core.refresh_tokens
           SET revoked_at = now()
           WHERE family_id = $1 AND revoked_at IS NULL`,
          [session.refresh_token_family_id]
        );
      }
      await writeAudit(client, input, "auth.session.revoke", "accepted", { sessionId });
    });
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

  if (isServicePrincipal(input)) {
    return userSessionRequiredResponse();
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

async function findModule(db: RuntimeDatabase | RuntimeDatabaseClient, key: string) {
  return db.one<PlatformModuleRow>(
    `SELECT id, key, name, description, category, status, version, installed_version, is_core, is_enabled,
            requires_license, license_status, dependencies, capabilities, settings_schema, created_at, updated_at
     FROM platform_modules
     WHERE key = $1
     LIMIT 1`,
    [key]
  );
}

function parseModulePath(pathname: string) {
  if (pathname === "/v1/modules") {
    return { collection: true } as const;
  }

  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "v1" || parts[1] !== "modules" || !parts[2]) {
    return null;
  }

  const key = decodeURIComponent(parts[2]);
  if (!moduleKeyPattern.test(key)) {
    return null;
  }

  return {
    collection: false,
    key,
    action: parts[3],
    extra: parts.slice(4)
  } as const;
}

async function handleModuleList(input: OperationalRouteInput) {
  const denied = await requireSuperAdmin(input);
  if (denied) {
    return denied;
  }

  try {
    const modules = await input.db.query<PlatformModuleRow>(
      `SELECT id, key, name, description, category, status, version, installed_version, is_core, is_enabled,
              requires_license, license_status, dependencies, capabilities, settings_schema, created_at, updated_at
       FROM platform_modules
       ORDER BY category, name`
    );
    return json(200, {
      status: "ok",
      modules: modules.map(serializeModule)
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "modules.list" });
    }
    throw error;
  }
}

async function handleModuleDetail(input: OperationalRouteInput, key: string) {
  const denied = await requireSuperAdmin(input);
  if (denied) {
    return denied;
  }

  try {
    const moduleRow = await findModule(input.db, key);
    if (!moduleRow) {
      return json(404, { status: "module_not_found", key });
    }

    const settings = await input.db.query(
      `SELECT id, tenant_id, settings, created_at, updated_at
       FROM platform_module_settings
       WHERE module_id = $1 AND ($2::text IS NULL OR tenant_id = $2)
       ORDER BY updated_at DESC
       LIMIT 20`,
      [moduleRow.id, input.context.tenantId ?? null]
    );

    return json(200, {
      status: "ok",
      module: serializeModule(moduleRow),
      settings
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "modules.detail" });
    }
    throw error;
  }
}

async function handleModuleEvents(input: OperationalRouteInput, key: string) {
  const denied = await requireSuperAdmin(input);
  if (denied) {
    return denied;
  }

  try {
    const moduleRow = await findModule(input.db, key);
    if (!moduleRow) {
      return json(404, { status: "module_not_found", key });
    }

    const events = await input.db.query<PlatformModuleEventRow>(
      `SELECT id, module_id, event_type, actor_principal_id, payload, created_at
       FROM platform_module_events
       WHERE module_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [moduleRow.id]
    );

    return json(200, {
      status: "ok",
      module: serializeModule(moduleRow),
      events
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "modules.events" });
    }
    throw error;
  }
}

async function findMissingDependencies(db: RuntimeDatabase | RuntimeDatabaseClient, dependencies: readonly string[]) {
  if (dependencies.length === 0) {
    return [];
  }

  const rows = await db.query<{ readonly key: string; readonly is_enabled: boolean }>(
    `SELECT key, is_enabled FROM platform_modules WHERE key = ANY($1::text[])`,
    [dependencies]
  );
  const enabled = new Set(rows.filter((row) => row.is_enabled).map((row) => row.key));
  return dependencies.filter((dependency) => !enabled.has(dependency));
}

async function handleModuleEnable(input: OperationalRouteInput, key: string) {
  const denied = await requireSuperAdmin(input);
  if (denied) {
    return denied;
  }

  try {
    return await input.db.transaction(async (client) => {
      const moduleRow = await findModule(client, key);
      if (!moduleRow) {
        return json(404, { status: "module_not_found", key });
      }

      const missingDependencies = await findMissingDependencies(client, moduleDependencies(moduleRow.dependencies));
      if (missingDependencies.length > 0) {
        await writeModuleEvent(client, input, moduleRow.id, "module_dependency_blocked", { key, missingDependencies });
        return json(409, {
          status: "module_dependency_blocked",
          key,
          missingDependencies
        });
      }

      const updated = await client.one<PlatformModuleRow>(
        `UPDATE platform_modules
         SET is_enabled = true,
             status = 'active',
             installed_version = COALESCE(installed_version, version),
             updated_at = now()
         WHERE key = $1
         RETURNING id, key, name, description, category, status, version, installed_version, is_core, is_enabled,
                   requires_license, license_status, dependencies, capabilities, settings_schema, created_at, updated_at`,
        [key]
      );

      await writeModuleEvent(client, input, moduleRow.id, "module_enabled", { key });
      return json(200, { status: "ok", module: updated ? serializeModule(updated) : serializeModule(moduleRow) });
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "modules.enable" });
    }
    throw error;
  }
}

async function handleModuleDisable(input: OperationalRouteInput, key: string) {
  const denied = await requireSuperAdmin(input);
  if (denied) {
    return denied;
  }

  try {
    return await input.db.transaction(async (client) => {
      const moduleRow = await findModule(client, key);
      if (!moduleRow) {
        return json(404, { status: "module_not_found", key });
      }

      if (moduleRow.is_core) {
        await writeModuleEvent(client, input, moduleRow.id, "module_disable_blocked", { key, reason: "core_module" });
        return json(409, {
          status: "core_module_disable_blocked",
          key
        });
      }

      const updated = await client.one<PlatformModuleRow>(
        `UPDATE platform_modules
         SET is_enabled = false,
             status = 'disabled',
             updated_at = now()
         WHERE key = $1
         RETURNING id, key, name, description, category, status, version, installed_version, is_core, is_enabled,
                   requires_license, license_status, dependencies, capabilities, settings_schema, created_at, updated_at`,
        [key]
      );

      await writeModuleEvent(client, input, moduleRow.id, "module_disabled", { key });
      return json(200, { status: "ok", module: updated ? serializeModule(updated) : serializeModule(moduleRow) });
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "modules.disable" });
    }
    throw error;
  }
}

async function handleModuleSettingsUpdate(input: OperationalRouteInput, key: string) {
  const denied = await requireSuperAdmin(input);
  if (denied) {
    return denied;
  }

  const settings = input.body.settings;
  if (!jsonObject(settings)) {
    return json(422, {
      status: "module_settings_invalid",
      required: ["settings object"]
    });
  }

  try {
    return await input.db.transaction(async (client) => {
      const moduleRow = await findModule(client, key);
      if (!moduleRow) {
        return json(404, { status: "module_not_found", key });
      }

      const saved = await client.one(
        `INSERT INTO platform_module_settings (module_id, tenant_id, settings)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (module_id, tenant_id)
         DO UPDATE SET settings = excluded.settings, updated_at = now()
         RETURNING id, tenant_id, settings, created_at, updated_at`,
        [moduleRow.id, input.context.tenantId ?? null, settings]
      );

      await writeModuleEvent(client, input, moduleRow.id, "module_settings_updated", { key, tenantId: input.context.tenantId ?? null });
      return json(200, {
        status: "ok",
        module: serializeModule(moduleRow),
        settings: saved
      });
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "modules.settings" });
    }
    throw error;
  }
}

async function handleModuleRoute(input: OperationalRouteInput) {
  const parsed = parseModulePath(input.pathname);
  if (!parsed) {
    return json(404, { status: "module_route_not_found", path: input.pathname });
  }

  if (parsed.collection) {
    return input.method === "GET" ? handleModuleList(input) : json(405, { status: "method_not_allowed", allowedMethods: ["GET"] });
  }

  if (!parsed.action && input.method === "GET") {
    return handleModuleDetail(input, parsed.key);
  }

  if (parsed.action === "events" && input.method === "GET" && parsed.extra.length === 0) {
    return handleModuleEvents(input, parsed.key);
  }

  if (parsed.action === "enable" && input.method === "POST" && parsed.extra.length === 0) {
    return handleModuleEnable(input, parsed.key);
  }

  if (parsed.action === "disable" && input.method === "POST" && parsed.extra.length === 0) {
    return handleModuleDisable(input, parsed.key);
  }

  if (parsed.action === "settings" && input.method === "PATCH" && parsed.extra.length === 0) {
    return handleModuleSettingsUpdate(input, parsed.key);
  }

  return json(404, { status: "module_route_not_found", path: input.pathname });
}

async function findPlugin(db: RuntimeDatabase | RuntimeDatabaseClient, key: string) {
  return db.one<PlatformPluginRow>(
    `SELECT id, key, name, description, category, status, version, installed_version, provider, source_type,
            is_core, is_enabled, requires_license, license_status, required_modules, permissions,
            capabilities, settings_schema, install_manifest, created_at, updated_at
     FROM platform_plugins
     WHERE key = $1
     LIMIT 1`,
    [key]
  );
}

function parsePluginPath(pathname: string) {
  if (pathname === "/v1/plugins") {
    return { collection: true } as const;
  }

  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "v1" || parts[1] !== "plugins" || !parts[2]) {
    return null;
  }

  const key = decodeURIComponent(parts[2]);
  if (!moduleKeyPattern.test(key)) {
    return null;
  }

  return {
    collection: false,
    key,
    action: parts[3],
    extra: parts.slice(4)
  } as const;
}

async function getPluginsModuleState(db: RuntimeDatabase | RuntimeDatabaseClient) {
  const row = await findModule(db, "plugins");
  return row ? serializeModule(row) : null;
}

async function handlePluginList(input: OperationalRouteInput) {
  const denied = await requireSuperAdmin(input);
  if (denied) {
    return denied;
  }

  try {
    const [plugins, moduleState] = await Promise.all([
      input.db.query<PlatformPluginRow>(
        `SELECT id, key, name, description, category, status, version, installed_version, provider, source_type,
                is_core, is_enabled, requires_license, license_status, required_modules, permissions,
                capabilities, settings_schema, install_manifest, created_at, updated_at
         FROM platform_plugins
         ORDER BY category, name`
      ),
      getPluginsModuleState(input.db)
    ]);
    return json(200, {
      status: "ok",
      plugins: plugins.map(serializePlugin),
      module: moduleState
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "plugins.list" });
    }
    throw error;
  }
}

async function handlePluginDetail(input: OperationalRouteInput, key: string) {
  const denied = await requireSuperAdmin(input);
  if (denied) {
    return denied;
  }

  try {
    const plugin = await findPlugin(input.db, key);
    if (!plugin) {
      return json(404, { status: "plugin_not_found", key });
    }

    const settings = await input.db.query(
      `SELECT id, tenant_id, settings, created_at, updated_at
       FROM platform_plugin_settings
       WHERE plugin_id = $1 AND ($2::text IS NULL OR tenant_id = $2)
       ORDER BY updated_at DESC
       LIMIT 20`,
      [plugin.id, input.context.tenantId ?? null]
    );

    return json(200, {
      status: "ok",
      plugin: serializePlugin(plugin),
      settings
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "plugins.detail" });
    }
    throw error;
  }
}

async function handlePluginEvents(input: OperationalRouteInput, key: string) {
  const denied = await requireSuperAdmin(input);
  if (denied) {
    return denied;
  }

  try {
    const plugin = await findPlugin(input.db, key);
    if (!plugin) {
      return json(404, { status: "plugin_not_found", key });
    }

    const events = await input.db.query<PlatformPluginEventRow>(
      `SELECT id, plugin_id, tenant_id, event_type, actor_principal_id, payload, created_at
       FROM platform_plugin_events
       WHERE plugin_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [plugin.id]
    );

    return json(200, {
      status: "ok",
      plugin: serializePlugin(plugin),
      events
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "plugins.events" });
    }
    throw error;
  }
}

async function handlePluginActivate(input: OperationalRouteInput, key: string) {
  const denied = await requireSuperAdmin(input);
  if (denied) {
    return denied;
  }

  try {
    return await input.db.transaction(async (client) => {
      const plugin = await findPlugin(client, key);
      if (!plugin) {
        return json(404, { status: "plugin_not_found", key });
      }

      const requiredModules = pluginRequiredModules(plugin.required_modules);
      const missingModules = await findMissingDependencies(client, requiredModules);
      if (missingModules.length > 0) {
        await writePluginEvent(
          client,
          input,
          "plugin_required_module_missing",
          { key, missingModules },
          { pluginId: plugin.id, tenantId: input.context.tenantId ?? null }
        );
        await writePluginEvent(
          client,
          input,
          "plugin_activation_blocked",
          { key, reason: "required_module_missing", missingModules },
          { pluginId: plugin.id, tenantId: input.context.tenantId ?? null }
        );
        return json(409, { status: "plugin_required_module_missing", key, missingModules });
      }

      const updated = await client.one<PlatformPluginRow>(
        `UPDATE platform_plugins
         SET is_enabled = true,
             status = 'active',
             installed_version = COALESCE(installed_version, version),
             updated_at = now()
         WHERE key = $1
         RETURNING id, key, name, description, category, status, version, installed_version, provider, source_type,
                   is_core, is_enabled, requires_license, license_status, required_modules, permissions,
                   capabilities, settings_schema, install_manifest, created_at, updated_at`,
        [key]
      );

      await writePluginEvent(client, input, "plugin_activated", { key }, { pluginId: plugin.id, tenantId: input.context.tenantId ?? null });
      return json(200, { status: "ok", plugin: updated ? serializePlugin(updated) : serializePlugin(plugin) });
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "plugins.activate" });
    }
    throw error;
  }
}

async function handlePluginDeactivate(input: OperationalRouteInput, key: string) {
  const denied = await requireSuperAdmin(input);
  if (denied) {
    return denied;
  }

  try {
    return await input.db.transaction(async (client) => {
      const plugin = await findPlugin(client, key);
      if (!plugin) {
        return json(404, { status: "plugin_not_found", key });
      }

      const updated = await client.one<PlatformPluginRow>(
        `UPDATE platform_plugins
         SET is_enabled = false,
             status = 'disabled',
             updated_at = now()
         WHERE key = $1
         RETURNING id, key, name, description, category, status, version, installed_version, provider, source_type,
                   is_core, is_enabled, requires_license, license_status, required_modules, permissions,
                   capabilities, settings_schema, install_manifest, created_at, updated_at`,
        [key]
      );

      await writePluginEvent(client, input, "plugin_deactivated", { key }, { pluginId: plugin.id, tenantId: input.context.tenantId ?? null });
      return json(200, { status: "ok", plugin: updated ? serializePlugin(updated) : serializePlugin(plugin) });
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "plugins.deactivate" });
    }
    throw error;
  }
}

async function handlePluginSettingsUpdate(input: OperationalRouteInput, key: string) {
  const denied = await requireSuperAdmin(input);
  if (denied) {
    return denied;
  }

  const settings = input.body.settings;
  if (!jsonObject(settings)) {
    return json(422, {
      status: "plugin_settings_invalid",
      required: ["settings object"]
    });
  }

  try {
    return await input.db.transaction(async (client) => {
      const plugin = await findPlugin(client, key);
      if (!plugin) {
        return json(404, { status: "plugin_not_found", key });
      }

      const saved = await client.one(
        `INSERT INTO platform_plugin_settings (plugin_id, tenant_id, settings)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (plugin_id, tenant_id)
         DO UPDATE SET settings = excluded.settings, updated_at = now()
         RETURNING id, tenant_id, settings, created_at, updated_at`,
        [plugin.id, input.context.tenantId ?? null, settings]
      );

      await writePluginEvent(
        client,
        input,
        "plugin_settings_updated",
        { key, tenantId: input.context.tenantId ?? null },
        { pluginId: plugin.id, tenantId: input.context.tenantId ?? null }
      );
      return json(200, {
        status: "ok",
        plugin: serializePlugin(plugin),
        settings: saved
      });
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "plugins.settings" });
    }
    throw error;
  }
}

async function handlePluginRoute(input: OperationalRouteInput) {
  const parsed = parsePluginPath(input.pathname);
  if (!parsed) {
    return json(404, { status: "plugin_route_not_found", path: input.pathname });
  }

  if (parsed.collection) {
    return input.method === "GET" ? handlePluginList(input) : json(405, { status: "method_not_allowed", allowedMethods: ["GET"] });
  }

  if (!parsed.action && input.method === "GET") {
    return handlePluginDetail(input, parsed.key);
  }

  if (parsed.action === "events" && input.method === "GET" && parsed.extra.length === 0) {
    return handlePluginEvents(input, parsed.key);
  }

  if (parsed.action === "activate" && input.method === "POST" && parsed.extra.length === 0) {
    return handlePluginActivate(input, parsed.key);
  }

  if (parsed.action === "deactivate" && input.method === "POST" && parsed.extra.length === 0) {
    return handlePluginDeactivate(input, parsed.key);
  }

  if (parsed.action === "settings" && input.method === "PATCH" && parsed.extra.length === 0) {
    return handlePluginSettingsUpdate(input, parsed.key);
  }

  return json(404, { status: "plugin_route_not_found", path: input.pathname });
}

async function findTheme(db: RuntimeDatabase | RuntimeDatabaseClient, key: string) {
  return db.one<PlatformThemeRow>(
    `SELECT id, key, name, description, industry, category, status, version, is_core, is_premium,
            supports_dark_mode, supports_mobile, supports_rtl, preview_image_url, capabilities,
            design_tokens, layout_presets, required_modules, created_at, updated_at
     FROM platform_themes
     WHERE key = $1
     LIMIT 1`,
    [key]
  );
}

async function findTenant(db: RuntimeDatabase | RuntimeDatabaseClient, tenantId: string) {
  return db.one<{ readonly tenant_id: string }>(
    `SELECT tenant_id FROM tenant_registry.tenants WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
}

async function getThemesModuleState(db: RuntimeDatabase | RuntimeDatabaseClient) {
  const row = await findModule(db, "themes");
  return row ? serializeModule(row) : null;
}

async function getThemeAssignment(db: RuntimeDatabase | RuntimeDatabaseClient, tenantId: string) {
  return db.one<PlatformThemeAssignmentRow>(
    `SELECT a.id, a.tenant_id, a.theme_id, a.status, a.assigned_by_principal_id, a.activated_at,
            a.settings, a.created_at, a.updated_at,
            t.key AS theme_key, t.name AS theme_name, t.industry AS theme_industry, t.category AS theme_category
     FROM platform_theme_assignments a
     JOIN platform_themes t ON t.id = a.theme_id
     WHERE a.tenant_id = $1
     LIMIT 1`,
    [tenantId]
  );
}

async function handleThemeList(input: OperationalRouteInput) {
  const denied = await requireThemeAccess(input);
  if (denied) {
    return denied;
  }

  try {
    const [themes, moduleState] = await Promise.all([
      input.db.query<PlatformThemeRow>(
        `SELECT id, key, name, description, industry, category, status, version, is_core, is_premium,
                supports_dark_mode, supports_mobile, supports_rtl, preview_image_url, capabilities,
                design_tokens, layout_presets, required_modules, created_at, updated_at
         FROM platform_themes
         ORDER BY industry, name`
      ),
      getThemesModuleState(input.db)
    ]);

    return json(200, {
      status: "ok",
      themes: themes.map(serializeTheme),
      module: moduleState,
      moduleWarning: moduleState?.isEnabled === false ? "themes_module_disabled" : undefined
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "themes.list" });
    }
    throw error;
  }
}

async function handleThemeIndustries(input: OperationalRouteInput) {
  const denied = await requireThemeAccess(input);
  if (denied) {
    return denied;
  }

  try {
    const industries = await input.db.query<{ readonly industry: string; readonly count: number }>(
      `SELECT industry, count(*)::int AS count
       FROM platform_themes
       GROUP BY industry
       ORDER BY industry`
    );
    return json(200, { status: "ok", industries });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "themes.industries" });
    }
    throw error;
  }
}

async function handleThemeDetail(input: OperationalRouteInput, key: string) {
  const denied = await requireThemeAccess(input);
  if (denied) {
    return denied;
  }

  try {
    const theme = await findTheme(input.db, key);
    if (!theme) {
      return json(404, { status: "theme_not_found", key });
    }

    return json(200, {
      status: "ok",
      theme: serializeTheme(theme),
      module: await getThemesModuleState(input.db)
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "themes.detail" });
    }
    throw error;
  }
}

function parseThemePath(pathname: string) {
  if (pathname === "/v1/themes") {
    return { collection: true } as const;
  }

  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "v1" || parts[1] !== "themes") {
    return null;
  }

  if (parts[2] === "industries" && parts.length === 3) {
    return { industries: true } as const;
  }

  const key = parts[2] ? decodeURIComponent(parts[2]) : "";
  if (!key || !moduleKeyPattern.test(key) || parts.length !== 3) {
    return null;
  }

  return { collection: false, key } as const;
}

async function handleThemeRoute(input: OperationalRouteInput) {
  const parsed = parseThemePath(input.pathname);
  if (!parsed) {
    return json(404, { status: "theme_route_not_found", path: input.pathname });
  }

  if ("collection" in parsed && parsed.collection) {
    return input.method === "GET" ? handleThemeList(input) : json(405, { status: "method_not_allowed", allowedMethods: ["GET"] });
  }

  if ("industries" in parsed) {
    return input.method === "GET" ? handleThemeIndustries(input) : json(405, { status: "method_not_allowed", allowedMethods: ["GET"] });
  }

  return input.method === "GET"
    ? handleThemeDetail(input, parsed.key)
    : json(405, { status: "method_not_allowed", allowedMethods: ["GET"] });
}

function parseTenantThemePath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "v1" || parts[1] !== "tenants" || !parts[2] || parts[3] !== "theme") {
    return null;
  }

  return {
    tenantId: decodeURIComponent(parts[2]),
    action: parts[4],
    extra: parts.slice(5)
  } as const;
}

async function handleTenantThemeGet(input: OperationalRouteInput, tenantId: string) {
  const denied = await requireThemeAccess(input, tenantId);
  if (denied) {
    return denied;
  }

  try {
    const tenant = await findTenant(input.db, tenantId);
    if (!tenant) {
      return json(404, { status: "tenant_not_found", tenantId });
    }

    const [assignment, events, moduleState] = await Promise.all([
      getThemeAssignment(input.db, tenantId),
      input.db.query<PlatformThemeEventRow>(
        `SELECT id, theme_id, tenant_id, event_type, actor_principal_id, payload, created_at
         FROM platform_theme_events
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [tenantId]
      ),
      getThemesModuleState(input.db)
    ]);

    return json(200, {
      status: "ok",
      tenantId,
      assignment: serializeThemeAssignment(assignment),
      events,
      module: moduleState,
      emptyState: assignment ? undefined : emptyOperationalState("tenant.theme", "theme_assignment_not_found")
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "tenant.theme.get" });
    }
    throw error;
  }
}

async function handleTenantThemeAssign(input: OperationalRouteInput, tenantId: string) {
  const denied = await requireThemeAccess(input, tenantId);
  if (denied) {
    return denied;
  }

  const themeKey = asString(input.body.themeKey) ?? asString(input.body.key);
  const settings = input.body.settings ?? {};
  if (!themeKey || !moduleKeyPattern.test(themeKey) || !jsonObject(settings)) {
    return json(422, { status: "theme_assignment_payload_invalid", required: ["themeKey", "settings object"] });
  }

  try {
    return await input.db.transaction(async (client) => {
      const tenant = await findTenant(client, tenantId);
      if (!tenant) {
        return json(404, { status: "tenant_not_found", tenantId });
      }

      const theme = await findTheme(client, themeKey);
      if (!theme) {
        return json(404, { status: "theme_not_found", key: themeKey });
      }

      const requiredModules = Array.from(new Set(["themes", ...themeRequiredModules(theme.required_modules)]));
      const missingModules = await findMissingDependencies(client, requiredModules);
      if (missingModules.length > 0) {
        await writeThemeEvent(
          client,
          input,
          "theme_required_module_missing",
          { themeKey, missingModules },
          { themeId: theme.id, tenantId }
        );
        await writeThemeEvent(
          client,
          input,
          "theme_assignment_blocked",
          { themeKey, reason: "required_module_missing", missingModules },
          { themeId: theme.id, tenantId }
        );
        return json(409, { status: "theme_required_module_missing", themeKey, tenantId, missingModules });
      }

      const assignment = await client.one<PlatformThemeAssignmentRow>(
        `INSERT INTO platform_theme_assignments
          (tenant_id, theme_id, status, assigned_by_principal_id, activated_at, settings)
         VALUES ($1, $2, 'active', $3::uuid, now(), $4::jsonb)
         ON CONFLICT (tenant_id) DO UPDATE
         SET theme_id = excluded.theme_id,
             status = 'active',
             assigned_by_principal_id = excluded.assigned_by_principal_id,
             activated_at = now(),
             settings = excluded.settings,
             updated_at = now()
         RETURNING id, tenant_id, theme_id, status, assigned_by_principal_id, activated_at, settings, created_at, updated_at`,
        [tenantId, theme.id, actorPrincipalId(input), settings]
      );

      await writeThemeEvent(client, input, "theme_assigned", { themeKey }, { themeId: theme.id, tenantId });
      return json(200, {
        status: "ok",
        tenantId,
        theme: serializeTheme(theme),
        assignment: serializeThemeAssignment(assignment)
      });
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "tenant.theme.assign" });
    }
    throw error;
  }
}

async function handleTenantThemeSettings(input: OperationalRouteInput, tenantId: string) {
  const denied = await requireThemeAccess(input, tenantId);
  if (denied) {
    return denied;
  }

  const settings = input.body.settings;
  if (!jsonObject(settings)) {
    return json(422, { status: "theme_settings_invalid", required: ["settings object"] });
  }

  try {
    return await input.db.transaction(async (client) => {
      const tenant = await findTenant(client, tenantId);
      if (!tenant) {
        return json(404, { status: "tenant_not_found", tenantId });
      }

      const current = await getThemeAssignment(client, tenantId);
      if (!current) {
        return json(404, { status: "theme_assignment_not_found", tenantId });
      }

      const updated = await client.one<PlatformThemeAssignmentRow>(
        `UPDATE platform_theme_assignments
         SET settings = $2::jsonb, updated_at = now()
         WHERE tenant_id = $1
         RETURNING id, tenant_id, theme_id, status, assigned_by_principal_id, activated_at, settings, created_at, updated_at`,
        [tenantId, settings]
      );

      await writeThemeEvent(client, input, "theme_settings_updated", {}, { themeId: current.theme_id, tenantId });
      return json(200, { status: "ok", tenantId, assignment: serializeThemeAssignment(updated) });
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "tenant.theme.settings" });
    }
    throw error;
  }
}

async function handleTenantThemeEvents(input: OperationalRouteInput, tenantId: string) {
  const denied = await requireThemeAccess(input, tenantId);
  if (denied) {
    return denied;
  }

  try {
    const tenant = await findTenant(input.db, tenantId);
    if (!tenant) {
      return json(404, { status: "tenant_not_found", tenantId });
    }

    const events = await input.db.query<PlatformThemeEventRow>(
      `SELECT id, theme_id, tenant_id, event_type, actor_principal_id, payload, created_at
       FROM platform_theme_events
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [tenantId]
    );
    return json(200, { status: "ok", tenantId, events });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "tenant.theme.events" });
    }
    throw error;
  }
}

async function handleTenantThemeRoute(input: OperationalRouteInput) {
  const parsed = parseTenantThemePath(input.pathname);
  if (!parsed || !parsed.tenantId) {
    return json(404, { status: "tenant_theme_route_not_found", path: input.pathname });
  }

  if (!parsed.action && input.method === "GET") {
    return handleTenantThemeGet(input, parsed.tenantId);
  }

  if (parsed.action === "assign" && input.method === "POST" && parsed.extra.length === 0) {
    return handleTenantThemeAssign(input, parsed.tenantId);
  }

  if (parsed.action === "settings" && input.method === "PATCH" && parsed.extra.length === 0) {
    return handleTenantThemeSettings(input, parsed.tenantId);
  }

  if (parsed.action === "events" && input.method === "GET" && parsed.extra.length === 0) {
    return handleTenantThemeEvents(input, parsed.tenantId);
  }

  return json(404, { status: "tenant_theme_route_not_found", path: input.pathname });
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

  if (!input.auth.roles.includes("super_admin")) {
    return json(403, { status: "super_admin_required" });
  }

  if (!(await hasActiveJwtSession(input))) {
    return unauthorized(["session_inactive"]);
  }

  const slug = asString(input.body.slug) ?? asString(input.body.tenantId);
  const displayName = asString(input.body.tenantName) ?? asString(input.body.displayName) ?? asString(input.body.brandName);
  const countryCode = asString(input.body.country) ?? asString(input.body.countryCode) ?? "TR";
  const defaultLocale = asString(input.body.locale) ?? asString(input.body.defaultLocale) ?? "tr-TR";
  const defaultCurrency = asString(input.body.currency) ?? asString(input.body.defaultCurrency) ?? "TRY";
  const timezone = asString(input.body.timezone) ?? "Europe/Istanbul";
  const erpMode = asString(input.body.erpMode) ?? "odoo-placeholder";
  const commerceMode = asString(input.body.commerceMode) ?? "medusa-placeholder";
  const requestedWorkspaces = asStringArray(input.body.workspaces) ?? workspaceTypes;
  const invalidWorkspace = requestedWorkspaces.find((workspace) => !workspaceTypes.includes(workspace as WorkspaceType));
  const tenantId = slug?.trim().toLowerCase();

  if (
    !tenantId ||
    !/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(tenantId) ||
    !displayName ||
    displayName.length < 2 ||
    !/^[A-Z]{2}$/.test(countryCode) ||
    invalidWorkspace
  ) {
    return json(422, {
      status: "tenant_payload_invalid",
      required: ["tenantName", "slug", "country", "currency", "locale", "timezone", "erpMode", "commerceMode"],
      constraints: {
        slug: "lowercase letters, numbers and hyphen; 3-63 chars",
        country: "ISO-3166 alpha-2",
        invalidWorkspace
      }
    });
  }

  const isolationPlan = createTenantIsolationPlan(tenantId);
  const idempotencyKey = getHeader(input.request, defaultRetryPolicy.idempotencyKeyHeader) ?? `tenant-onboarding:${tenantId}`;
  const normalizedTenantId = tenantId.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");

  try {
    return await input.db.transaction(async (client) => {
      const existing = await client.one<{ readonly tenant_id: string }>(
        `SELECT tenant_id FROM tenant_registry.tenants WHERE tenant_id = $1 LIMIT 1`,
        [tenantId]
      );

      if (existing) {
        await writeAudit(client, input, "tenant.create", "rejected", { tenantId, reason: "duplicate_slug" });
        return json(409, { status: "tenant_slug_conflict", tenantId });
      }

      await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(`tenant_${normalizedTenantId}`)}`);
      await client.query(
        `INSERT INTO tenant_registry.tenants
          (tenant_id, lifecycle_state, isolation_mode, default_locale, default_currency, display_name, country_code, timezone)
         VALUES ($1, 'provisioning', $2, $3, $4, $5, $6, $7)`,
        [tenantId, isolationPlan.isolationMode, defaultLocale, defaultCurrency, displayName, countryCode, timezone]
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
        [tenantId, displayName, input.body.colorTokens && typeof input.body.colorTokens === "object" ? input.body.colorTokens : {}]
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
        `INSERT INTO tenant_registry.tenant_erp_bridges
          (tenant_id, odoo_database, odoo_company_ids, raw_ui_allowed, enabled, provisioning_status)
         VALUES ($1, $2, $3, false, true, $4)
         ON CONFLICT DO NOTHING`,
        [tenantId, `odoo_${normalizedTenantId}`, [], erpMode]
      );
      await client.query(
        `INSERT INTO tenant_registry.tenant_commerce_bridges
          (tenant_id, medusa_region_scope, admin_ui_allowed, enabled, provisioning_status)
         VALUES ($1, $2, false, true, $3)
         ON CONFLICT DO NOTHING`,
        [tenantId, `region_${normalizedTenantId}`, commerceMode]
      );

      const eventId = await createOutboxEvent(
        client,
        input,
        "tenant_created",
        { tenantId, displayName, countryCode, defaultLocale, defaultCurrency, timezone, workspaces: requestedWorkspaces, isolationPlan },
        idempotencyKey,
        { tenantId, workspaceId: "central-admin" }
      );
      await client.query(
        `INSERT INTO tenant_registry.tenant_lifecycle_events (tenant_id, from_state, to_state, reason, correlation_id)
         VALUES ($1, NULL, 'provisioning', 'tenant_onboarding_runtime_started', $2)`,
        [tenantId, input.context.correlationId]
      );
      await writeAudit(client, input, "tenant_created", "accepted", { tenantId, eventId });

      return json(201, {
        status: "tenant_created",
        tenant: {
          tenantId,
          displayName,
          countryCode,
          defaultLocale,
          defaultCurrency,
          timezone,
          lifecycleState: "provisioning"
        },
        namespaces: {
          cache: isolationPlan.cacheNamespace,
          queue: isolationPlan.queueNamespace,
          event: isolationPlan.eventNamespace,
          storage: isolationPlan.storageNamespace,
          postgresSchema: isolationPlan.postgresSchema
        },
        bridgeState: {
          odoo: erpMode,
          medusa: commerceMode
        },
        eventId,
        tenantMiddlewareScopes
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
      `SELECT tenant_id, display_name, country_code, lifecycle_state, isolation_mode, default_locale, default_currency, timezone, created_at, updated_at
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

async function handleTenantDetail(input: OperationalRouteInput, tenantId: string) {
  const reasons = requireProtected(input);
  if (reasons.length > 0) {
    return unauthorized(reasons);
  }

  try {
    const tenant = await input.db.one(
      `SELECT tenant_id, display_name, country_code, lifecycle_state, isolation_mode, default_locale, default_currency, timezone, created_at, updated_at
       FROM tenant_registry.tenants
       WHERE tenant_id = $1
       LIMIT 1`,
      [tenantId]
    );

    if (!tenant) {
      return json(404, { status: "tenant_not_found", tenantId });
    }

    const [workspaces, isolation, erpBridges, commerceBridges, auditEvents, outboxEvents] = await Promise.all([
      input.db.query(
        `SELECT workspace_id, workspace_type, enabled, role_ids
         FROM tenant_registry.tenant_workspaces
         WHERE tenant_id = $1
         ORDER BY workspace_type`,
        [tenantId]
      ),
      input.db.one(
        `SELECT postgres_schema, redis_key_prefix, minio_bucket_prefix, meilisearch_index_prefix,
                cache_namespace, queue_namespace, event_namespace, storage_namespace
         FROM tenant_isolation.isolation_plans
         WHERE tenant_id = $1
         LIMIT 1`,
        [tenantId]
      ),
      input.db.query(
        `SELECT engine, odoo_database, raw_ui_allowed, enabled, provisioning_status
         FROM tenant_registry.tenant_erp_bridges
         WHERE tenant_id = $1
         ORDER BY engine`,
        [tenantId]
      ),
      input.db.query(
        `SELECT engine, medusa_region_scope, admin_ui_allowed, enabled, provisioning_status
         FROM tenant_registry.tenant_commerce_bridges
         WHERE tenant_id = $1
         ORDER BY engine`,
        [tenantId]
      ),
      input.db.query(
        `SELECT audit_id, action, result, payload, occurred_at
         FROM operational_audit.audit_events
         WHERE tenant_id = $1 OR payload->>'tenantId' = $1
         ORDER BY occurred_at DESC
         LIMIT 50`,
        [tenantId]
      ),
      input.db.query(
        `SELECT event_id, event_name, delivery_state, occurred_at
         FROM event_core.event_outbox
         WHERE tenant_id = $1 OR payload->>'tenantId' = $1
         ORDER BY occurred_at DESC
         LIMIT 50`,
        [tenantId]
      )
    ]);

    return json(200, {
      status: "ok",
      tenant,
      workspaces,
      namespaces: isolation,
      bridgeState: {
        odoo: erpBridges,
        medusa: commerceBridges
      },
      realtimeChannels: defaultRealtimeSubscriptions.map((subscription) => ({
        ...subscription,
        tenantChannel: `tenant:${tenantId}:${subscription.channel}`
      })),
      auditEvents,
      outboxEvents,
      storageNamespace: (isolation as { readonly storage_namespace?: string } | undefined)?.storage_namespace,
      emptyState:
        auditEvents.length === 0 && outboxEvents.length === 0
          ? emptyOperationalState("tenant.detail", "tenant_runtime_events_not_found")
          : undefined
    });
  } catch (error) {
    if (isRuntimeStoreUnavailable(error)) {
      return json(503, { status: "runtime_store_unavailable", operation: "tenant.detail" });
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
    pathname === "/v1/modules" ||
    pathname.startsWith("/v1/modules/") ||
    pathname === "/v1/plugins" ||
    pathname.startsWith("/v1/plugins/") ||
    pathname === "/v1/themes" ||
    pathname.startsWith("/v1/themes/") ||
    pathname === "/v1/tenants" ||
    pathname.startsWith("/v1/tenants/") ||
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
  if (input.pathname === "/v1/modules" || input.pathname.startsWith("/v1/modules/")) {
    return handleModuleRoute(input);
  }

  if (input.pathname === "/v1/plugins" || input.pathname.startsWith("/v1/plugins/")) {
    return handlePluginRoute(input);
  }

  if (input.pathname === "/v1/themes" || input.pathname.startsWith("/v1/themes/")) {
    return handleThemeRoute(input);
  }

  if (parseTenantThemePath(input.pathname)) {
    return handleTenantThemeRoute(input);
  }

  if (input.method === "GET") {
    switch (input.pathname) {
      case "/v1/auth/me":
        return handleMe(input);
      case "/v1/auth/sessions":
        return handleSessions(input);
      case "/v1/auth/activity":
        return handleActivity(input);
      case "/v1/tenants":
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
        if (input.pathname.startsWith("/v1/tenants/")) {
          const tenantId = decodeURIComponent(input.pathname.slice("/v1/tenants/".length));
          if (tenantId && tenantId !== "registry") {
            return handleTenantDetail(input, tenantId);
          }
        }
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
