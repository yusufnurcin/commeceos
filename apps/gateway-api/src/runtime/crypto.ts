import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  pbkdf2Sync,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from "node:crypto";
import type { GatewayEnvironment } from "../config/env";

export interface JwtClaims {
  readonly iss: string;
  readonly aud: string;
  readonly sub: string;
  readonly exp: number;
  readonly iat: number;
  readonly jti: string;
  readonly token_type: "access";
  readonly session_id: string;
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

export function hashPassword(password: string) {
  const iterations = 210_000;
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  return {
    algorithm: "pbkdf2-sha256",
    encodedHash: `pbkdf2-sha256$${iterations}$${salt}$${hash}`
  };
}

function integrationVaultKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

export function encryptIntegrationPayload(secret: string, payload: Record<string, unknown>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", integrationVaultKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `aes-256-gcm:v1:${iv.toString("base64url")}:${authTag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptIntegrationPayload(secret: string, encryptedPayload: string) {
  const [algorithm, version, ivText, authTagText, encryptedText] = encryptedPayload.split(":");
  if (algorithm !== "aes-256-gcm" || version !== "v1" || !ivText || !authTagText || !encryptedText) {
    throw new Error("integration_vault_payload_invalid");
  }

  const decipher = createDecipheriv("aes-256-gcm", integrationVaultKey(secret), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagText, "base64url"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
  const payload = JSON.parse(decrypted) as unknown;
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("integration_vault_payload_invalid");
  }
  return payload as Record<string, unknown>;
}
