export type PrincipalType =
  | "platform-operator"
  | "tenant-user"
  | "seller-user"
  | "customer-user"
  | "courier-user"
  | "finance-user"
  | "accounting-user"
  | "marketing-user"
  | "support-user"
  | "warehouse-user"
  | "procurement-user"
  | "service-account";
export type AuthMechanism = "jwt" | "session" | "service-token";
export type PolicyEffect = "allow" | "deny";
export type PermissionScope =
  | "platform"
  | "tenant"
  | "workspace"
  | "commerce"
  | "erp"
  | "sync"
  | "notification"
  | "ai"
  | "audit"
  | "observability";
export type TokenType = "access" | "refresh";
export type SessionRiskLevel = "low" | "medium" | "high" | "blocked";
export type MfaFactorType = "totp" | "webauthn" | "recovery-code" | "email-otp";
export type DeviceTrustState = "unknown" | "trusted" | "revoked";
export type LoginActivityResult = "accepted" | "challenged" | "rejected";

export interface Principal {
  readonly id: string;
  readonly type: PrincipalType;
  readonly tenantId?: string;
  readonly organizationId?: string;
}

export interface AuthSessionContext {
  readonly principal: Principal;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly sessionFingerprintHash: string;
  readonly deviceId: string;
  readonly mfaVerified: boolean;
  readonly refreshTokenFamilyId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly authProvider: string;
}

export interface JwtBoundary {
  readonly mechanism: "jwt";
  readonly issuer: string;
  readonly audience: string;
  readonly subject: string;
  readonly tokenType: TokenType;
  readonly tokenId: string;
  readonly rotationFamilyId?: string;
  readonly expiresAt: string;
}

export interface SessionBoundary {
  readonly mechanism: "session";
  readonly sessionId: string;
  readonly csrfRequired: true;
  readonly expiresAt: string;
}

export interface ServiceTokenBoundary {
  readonly mechanism: "service-token";
  readonly serviceName: string;
  readonly tokenId: string;
}

export interface HybridAuthBoundary {
  readonly acceptedMechanisms: readonly AuthMechanism[];
  readonly jwtHeader: typeof AUTHORIZATION_HEADER;
  readonly sessionCookie: typeof SESSION_COOKIE_NAME;
  readonly serviceTokenHeader: typeof SERVICE_TOKEN_HEADER;
  readonly rawOdooSessionAccepted: false;
}

export interface RoleContract {
  readonly roleId: string;
  readonly roleName: string;
  readonly scope: PermissionScope;
  readonly tenantBound: boolean;
  readonly workspaceBound: boolean;
}

export interface PermissionBlueprint {
  readonly permissionId: string;
  readonly resource: string;
  readonly action: string;
  readonly scope: PermissionScope;
  readonly effect: PolicyEffect;
}

export interface AbacConstraint {
  readonly attribute: string;
  readonly operator: "equals" | "contains" | "in" | "not-in";
  readonly valueSource: "principal" | "tenant" | "workspace" | "request";
}

export interface AccessPolicyContract {
  readonly policyId: string;
  readonly roles: readonly RoleContract[];
  readonly permissions: readonly PermissionBlueprint[];
  readonly abacConstraints: readonly AbacConstraint[];
}

export interface AccessDecision {
  readonly allowed: boolean;
  readonly effect: PolicyEffect;
  readonly reason: string;
  readonly evaluatedAt: string;
}

export interface TokenPairContract {
  readonly accessToken: JwtBoundary;
  readonly refreshToken: JwtBoundary;
  readonly rotation: JwtRotationPolicy;
  readonly tenantScoped: true;
  readonly workspaceScoped: true;
}

export interface SessionFingerprintContract {
  readonly fingerprintHeader: typeof SESSION_FINGERPRINT_HEADER;
  readonly hashAlgorithm: "sha256";
  readonly bindsUserAgent: true;
  readonly bindsIpRange: true;
  readonly rotatesOnRefresh: true;
}

export interface DeviceTrackingContract {
  readonly deviceIdHeader: typeof DEVICE_ID_HEADER;
  readonly trustStates: readonly DeviceTrustState[];
  readonly rememberDeviceRequiresMfa: true;
  readonly revokedDeviceBlocksSession: true;
}

export interface MfaFoundationContract {
  readonly requiredForImpersonation: true;
  readonly requiredForHighRiskLogin: true;
  readonly supportedFactors: readonly MfaFactorType[];
  readonly challengeTtlSeconds: number;
}

export interface PasswordPolicyContract {
  readonly minLength: number;
  readonly requireUppercase: true;
  readonly requireLowercase: true;
  readonly requireNumber: true;
  readonly requireSymbol: true;
  readonly denyCommonPasswords: true;
  readonly historySize: number;
  readonly maxAgeDays: number;
}

export interface EmailVerificationContract {
  readonly requiredBeforeWorkspaceAccess: true;
  readonly tokenTtlMinutes: number;
  readonly resendCooldownSeconds: number;
}

export interface TenantScopedSessionContract {
  readonly tenantHeader: string;
  readonly workspaceHeader: string;
  readonly tenantClaim: "tenant_id";
  readonly workspaceClaim: "workspace_id";
  readonly denyCrossTenantReplay: true;
}

export interface RolePermissionBindingContract {
  readonly roleId: string;
  readonly permissionIds: readonly string[];
  readonly tenantScoped: boolean;
  readonly workspaceScoped: boolean;
}

export interface WorkspaceAccessGrantContract {
  readonly workspaceId: string;
  readonly roleIds: readonly string[];
  readonly permissionIds: readonly string[];
  readonly expiresAt?: string;
}

export interface ImpersonationControlContract {
  readonly enabled: true;
  readonly requiresMfa: true;
  readonly requiresReason: true;
  readonly audited: true;
  readonly maxDurationMinutes: number;
  readonly rawCredentialSharingAllowed: false;
}

export interface LoginActivityContract {
  readonly capturedFields: readonly (
    | "principal_id"
    | "tenant_id"
    | "workspace_id"
    | "ip_hash"
    | "user_agent_hash"
    | "device_id"
    | "result"
    | "risk_level"
  )[];
  readonly retentionDays: number;
}

export interface SuspiciousLoginDetectionContract {
  readonly signals: readonly ("new_device" | "impossible_travel" | "ip_reputation" | "mfa_fatigue" | "tenant_mismatch")[];
  readonly highRiskRequiresMfa: true;
  readonly blockedRiskRejectsLogin: true;
}

export interface AuthRateLimitPolicyContract {
  readonly loginWindowSeconds: number;
  readonly loginMaxAttempts: number;
  readonly refreshWindowSeconds: number;
  readonly refreshMaxAttempts: number;
  readonly keyStrategy: "tenant:principal:ip:fingerprint";
}

export interface JwtRotationPolicy {
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
  readonly refreshTokenReuseDetection: true;
  readonly rotateRefreshTokenEveryUse: true;
  readonly revokeFamilyOnReuse: true;
}

export interface SecureCookieStrategyContract {
  readonly cookieName: typeof SESSION_COOKIE_NAME;
  readonly httpOnly: true;
  readonly secure: true;
  readonly sameSite: "strict" | "lax";
  readonly path: "/";
  readonly csrfDoubleSubmitRequired: true;
}

export interface AuthCoreContract {
  readonly tokenPair: TokenPairContract;
  readonly sessionFingerprint: SessionFingerprintContract;
  readonly deviceTracking: DeviceTrackingContract;
  readonly mfa: MfaFoundationContract;
  readonly passwordPolicy: PasswordPolicyContract;
  readonly emailVerification: EmailVerificationContract;
  readonly tenantScopedSession: TenantScopedSessionContract;
  readonly impersonation: ImpersonationControlContract;
  readonly loginActivity: LoginActivityContract;
  readonly suspiciousLoginDetection: SuspiciousLoginDetectionContract;
  readonly rateLimit: AuthRateLimitPolicyContract;
  readonly secureCookie: SecureCookieStrategyContract;
}

export const AUTHORIZATION_HEADER = "authorization";
export const SERVICE_TOKEN_HEADER = "x-commerce-service-token";
export const SESSION_COOKIE_NAME = "commerce_os_session";
export const SESSION_FINGERPRINT_HEADER = "x-commerce-session-fingerprint";
export const DEVICE_ID_HEADER = "x-commerce-device-id";
export const MFA_CHALLENGE_HEADER = "x-commerce-mfa-challenge";

export const defaultPasswordPolicy: PasswordPolicyContract = {
  minLength: 14,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: true,
  denyCommonPasswords: true,
  historySize: 8,
  maxAgeDays: 120
};

export const defaultJwtRotationPolicy: JwtRotationPolicy = {
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 2592000,
  refreshTokenReuseDetection: true,
  rotateRefreshTokenEveryUse: true,
  revokeFamilyOnReuse: true
};

export const defaultSecureCookieStrategy: SecureCookieStrategyContract = {
  cookieName: SESSION_COOKIE_NAME,
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  csrfDoubleSubmitRequired: true
};
