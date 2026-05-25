import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import {
  AUTHORIZATION_HEADER,
  DEVICE_ID_HEADER,
  SERVICE_TOKEN_HEADER,
  SESSION_COOKIE_NAME,
  SESSION_FINGERPRINT_HEADER,
  type AuthMechanism,
  type PrincipalType
} from "@commerce-os/auth-core";
import type { GatewayEnvironment } from "../config/env";
import type { RequestContext } from "./request-context";

export type AuthVerificationStatus = "valid" | "missing" | "invalid" | "unsupported";

export interface VerifiedAuthContext {
  readonly status: AuthVerificationStatus;
  readonly mechanism?: AuthMechanism;
  readonly principalId?: string;
  readonly principalType?: PrincipalType;
  readonly tenantId?: string;
  readonly workspaceId?: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly tokenId?: string;
  readonly sessionFingerprintHash?: string;
  readonly deviceId?: string;
  readonly mfaVerified?: boolean;
  readonly reasons: readonly string[];
}

interface JwtClaims {
  readonly iss?: string;
  readonly aud?: string | readonly string[];
  readonly sub?: string;
  readonly exp?: number;
  readonly nbf?: number;
  readonly jti?: string;
  readonly token_type?: "access" | "refresh";
  readonly principal_type?: PrincipalType;
  readonly tenant_id?: string;
  readonly workspace_id?: string;
  readonly roles?: readonly string[];
  readonly permissions?: readonly string[];
  readonly session_fingerprint_hash?: string;
  readonly device_id?: string;
  readonly mfa_verified?: boolean;
}

function headerValue(request: IncomingMessage, name: string) {
  const value = request.headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function base64UrlToBuffer(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function decodeJsonPart<T>(value: string): T | undefined {
  try {
    return JSON.parse(base64UrlToBuffer(value).toString("utf8")) as T;
  } catch {
    return undefined;
  }
}

function constantTimeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function verifyServiceToken(request: IncomingMessage, env: GatewayEnvironment): VerifiedAuthContext {
  const token = headerValue(request, SERVICE_TOKEN_HEADER);
  if (!token) {
    return { status: "missing", roles: [], permissions: [], reasons: ["service_token_missing"] };
  }

  const configuredHash = env.gatewayServiceToken.startsWith("sha256:")
    ? env.gatewayServiceToken.slice("sha256:".length)
    : sha256(env.gatewayServiceToken);

  if (!constantTimeEquals(sha256(token), configuredHash)) {
    return {
      status: "invalid",
      mechanism: "service-token",
      roles: [],
      permissions: [],
      reasons: ["service_token_hash_mismatch"]
    };
  }

  return {
    status: "valid",
    mechanism: "service-token",
    principalId: "gateway-service-token",
    principalType: "service-account",
    roles: ["service-account"],
    permissions: ["runtime.read", "business-core.read", "event.publish"],
    reasons: []
  };
}

function verifyJwt(request: IncomingMessage, env: GatewayEnvironment): VerifiedAuthContext {
  const authorization = headerValue(request, AUTHORIZATION_HEADER);
  const token = authorization?.toLowerCase().startsWith("bearer ") ? authorization.slice("bearer ".length).trim() : "";
  if (!token) {
    return { status: "missing", roles: [], permissions: [], reasons: ["bearer_token_missing"] };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return { status: "invalid", mechanism: "jwt", roles: [], permissions: [], reasons: ["jwt_malformed"] };
  }

  const header = decodeJsonPart<{ readonly alg?: string; readonly typ?: string }>(encodedHeader);
  const claims = decodeJsonPart<JwtClaims>(encodedPayload);
  if (!header || !claims) {
    return { status: "invalid", mechanism: "jwt", roles: [], permissions: [], reasons: ["jwt_decode_failed"] };
  }

  const reasons: string[] = [];
  if (header.alg !== "HS256") {
    reasons.push("jwt_alg_not_allowed");
  }

  const expectedSignature = createHmac("sha256", env.authJwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  if (!constantTimeEquals(encodedSignature, expectedSignature)) {
    reasons.push("jwt_signature_invalid");
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== env.authJwtIssuer) {
    reasons.push("jwt_issuer_invalid");
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
  if (!audiences.includes(env.authJwtAudience)) {
    reasons.push("jwt_audience_invalid");
  }

  if (!claims.sub) {
    reasons.push("jwt_subject_missing");
  }

  if (!claims.jti) {
    reasons.push("jwt_id_missing");
  }

  if (claims.token_type !== "access") {
    reasons.push("jwt_access_token_required");
  }

  if (!claims.exp || claims.exp <= now) {
    reasons.push("jwt_expired");
  }

  if (claims.nbf && claims.nbf > now) {
    reasons.push("jwt_not_before");
  }

  return {
    status: reasons.length === 0 ? "valid" : "invalid",
    mechanism: "jwt",
    roles: claims.roles ?? [],
    permissions: claims.permissions ?? [],
    reasons,
    ...(claims.sub ? { principalId: claims.sub } : {}),
    ...(claims.principal_type ? { principalType: claims.principal_type } : {}),
    ...(claims.tenant_id ? { tenantId: claims.tenant_id } : {}),
    ...(claims.workspace_id ? { workspaceId: claims.workspace_id } : {}),
    ...(claims.jti ? { tokenId: claims.jti } : {}),
    ...(claims.session_fingerprint_hash ? { sessionFingerprintHash: claims.session_fingerprint_hash } : {}),
    ...(claims.device_id ? { deviceId: claims.device_id } : {}),
    ...(typeof claims.mfa_verified === "boolean" ? { mfaVerified: claims.mfa_verified } : {})
  };
}

function resolveSessionCookie(request: IncomingMessage): VerifiedAuthContext {
  const cookie = headerValue(request, "cookie");
  if (!cookie?.includes(`${SESSION_COOKIE_NAME}=`)) {
    return { status: "missing", roles: [], permissions: [], reasons: ["session_cookie_missing"] };
  }

  return {
    status: "unsupported",
    mechanism: "session",
    roles: [],
    permissions: [],
    reasons: ["session_cookie_requires_persistent_session_adapter"]
  };
}

export function verifyGatewayAuth(
  request: IncomingMessage,
  env: GatewayEnvironment,
  context: RequestContext
): VerifiedAuthContext {
  if (context.authMechanism === "service-token") {
    return verifyServiceToken(request, env);
  }

  if (context.authMechanism === "jwt") {
    return verifyJwt(request, env);
  }

  if (context.authMechanism === "session") {
    return resolveSessionCookie(request);
  }

  return { status: "missing", roles: [], permissions: [], reasons: ["auth_mechanism_missing"] };
}

export function validateTenantWorkspaceScope(
  request: IncomingMessage,
  context: RequestContext,
  auth: VerifiedAuthContext
) {
  const reasons: string[] = [];
  if (auth.status !== "valid") {
    reasons.push(...auth.reasons);
  }

  if (!context.tenantId) {
    reasons.push("tenant_header_missing");
  }

  if (!context.workspaceId) {
    reasons.push("workspace_header_missing");
  }

  if (auth.mechanism === "jwt" && auth.tenantId && context.tenantId && auth.tenantId !== context.tenantId) {
    reasons.push("tenant_claim_header_mismatch");
  }

  if (auth.mechanism === "jwt" && auth.workspaceId && context.workspaceId && auth.workspaceId !== context.workspaceId) {
    reasons.push("workspace_claim_header_mismatch");
  }

  const fingerprint = headerValue(request, SESSION_FINGERPRINT_HEADER);
  if (auth.mechanism === "jwt" && auth.sessionFingerprintHash && fingerprint && sha256(fingerprint) !== auth.sessionFingerprintHash) {
    reasons.push("session_fingerprint_mismatch");
  }

  const deviceId = headerValue(request, DEVICE_ID_HEADER);
  if (auth.mechanism === "jwt" && auth.deviceId && deviceId && deviceId !== auth.deviceId) {
    reasons.push("device_id_mismatch");
  }

  return {
    allowed: reasons.length === 0,
    reasons
  } as const;
}
