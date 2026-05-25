import { createHash, createHmac, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { GatewayEnvironment } from "../config/env";

export interface JwtClaims {
  readonly iss: string;
  readonly aud: string;
  readonly sub: string;
  readonly exp: number;
  readonly iat: number;
  readonly jti: string;
  readonly token_type: "access";
  readonly principal_type: string;
  readonly tenant_id: string;
  readonly workspace_id: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly session_fingerprint_hash: string;
  readonly device_id: string;
  readonly mfa_verified: boolean;
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 48) {
  return randomBytes(bytes).toString("base64url");
}

export function constantTimeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function signAccessToken(env: GatewayEnvironment, claims: Omit<JwtClaims, "iss" | "aud" | "iat" | "jti" | "exp" | "token_type">) {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtClaims = {
    ...claims,
    iss: env.authJwtIssuer,
    aud: env.authJwtAudience,
    iat: now,
    exp: now + 900,
    jti: randomUUID(),
    token_type: "access"
  };
  const encodedHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", env.authJwtSecret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");

  return {
    token: `${encodedHeader}.${encodedPayload}.${signature}`,
    payload
  };
}

export function verifyPassword(password: string, encodedHash: string, algorithm: string) {
  if (algorithm !== "pbkdf2-sha256") {
    return false;
  }

  const [scheme, iterationText, salt, expectedHash] = encodedHash.split("$");
  const iterations = Number(iterationText);
  if (scheme !== "pbkdf2-sha256" || !Number.isFinite(iterations) || !salt || !expectedHash) {
    return false;
  }

  const actual = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  return constantTimeEquals(actual, expectedHash);
}
