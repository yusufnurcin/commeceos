import {
  DEVICE_ID_HEADER,
  MFA_CHALLENGE_HEADER,
  SESSION_FINGERPRINT_HEADER,
  defaultJwtRotationPolicy,
  defaultPasswordPolicy,
  defaultSecureCookieStrategy
} from "@commerce-os/auth-core";
import {
  defaultCommerceDomainBoundaries,
  medusaCommerceCoreContract,
  odooBridgeCoreContract
} from "@commerce-os/commerce-core";
import {
  defaultDeadLetterQueue,
  defaultEventContracts,
  defaultEventReplay,
  defaultRealtimeSubscriptions,
  defaultRetryPolicy
} from "@commerce-os/sync-core";
import {
  TENANT_HEADER,
  TENANT_REGION_HEADER,
  WORKSPACE_HEADER,
  createTenantIsolationPlan,
  tenantMiddlewareScopes,
  workspaceIsolationContracts,
  workspaceTypes
} from "@commerce-os/tenant-core";
import type { GatewayEnvironment } from "../config/env";
import type { ServiceHealthMatrix } from "../runtime/health-matrix";
import type { RequestContext } from "../runtime/request-context";
import type { ServiceRegistryEntry } from "../runtime/service-registry";
import type { VerifiedAuthContext } from "../runtime/auth-verifier";
import { createRuntimeTopologyPayload } from "./topology";

export interface BusinessRouteInput {
  readonly method: string | undefined;
  readonly pathname: string;
  readonly context: RequestContext;
  readonly auth: VerifiedAuthContext;
  readonly env: GatewayEnvironment;
  readonly registry: readonly ServiceRegistryEntry[];
  readonly healthMatrix?: ServiceHealthMatrix;
}

export interface BusinessRouteResult {
  readonly statusCode: number;
  readonly payload: unknown;
}

function authSummary(auth: VerifiedAuthContext) {
  return {
    status: auth.status,
    mechanism: auth.mechanism,
    principalType: auth.principalType,
    principalId: auth.principalId,
    tenantId: auth.tenantId,
    workspaceId: auth.workspaceId,
    roles: auth.roles,
    permissions: auth.permissions,
    mfaVerified: auth.mfaVerified,
    reasons: auth.reasons
  };
}

function createTenantRuntime(input: BusinessRouteInput) {
  const tenantId = input.context.tenantId ?? "missing-tenant";
  const workspaceId = input.context.workspaceId ?? "missing-workspace";
  const isolationPlan = createTenantIsolationPlan(tenantId);

  return {
    tenantId,
    workspaceId,
    tenantHeader: TENANT_HEADER,
    workspaceHeader: WORKSPACE_HEADER,
    regionHeader: TENANT_REGION_HEADER,
    isolationPlan,
    middlewareScopes: tenantMiddlewareScopes,
    serviceIsolation: {
      cacheNamespace: isolationPlan.cacheNamespace,
      storageNamespace: isolationPlan.storageNamespace,
      queueNamespace: isolationPlan.queueNamespace,
      eventNamespace: isolationPlan.eventNamespace,
      redisKeyPrefix: isolationPlan.redisKeyPrefix,
      minioBucketPrefix: isolationPlan.minioBucketPrefix,
      meilisearchIndexPrefix: isolationPlan.meilisearchIndexPrefix
    }
  };
}

function createAuthCorePayload(input: BusinessRouteInput) {
  return {
    status: "ok",
    module: "auth-core",
    noSeedAdmin: true,
    noExampleUser: true,
    noLocalMemoryAuth: true,
    authVerification: authSummary(input.auth),
    boundaries: {
      accessToken: {
        algorithm: "HS256",
        issuer: input.env.authJwtIssuer,
        audience: input.env.authJwtAudience,
        tokenType: "access",
        rotation: defaultJwtRotationPolicy
      },
      refreshToken: {
        rotation: defaultJwtRotationPolicy,
        persistenceRequired: "auth_core.refresh_tokens",
        reuseDetection: true
      },
      sessionFingerprint: {
        header: SESSION_FINGERPRINT_HEADER,
        hashAlgorithm: "sha256",
        requiredForJwtBoundSessions: true
      },
      deviceTracking: {
        header: DEVICE_ID_HEADER,
        persistenceRequired: "auth_core.devices",
        revokedDeviceBlocksSession: true
      },
      mfa: {
        challengeHeader: MFA_CHALLENGE_HEADER,
        requiredForImpersonation: true,
        requiredForHighRiskLogin: true,
        supportedFactors: ["totp", "webauthn", "recovery-code", "email-otp"]
      },
      passwordPolicy: defaultPasswordPolicy,
      emailVerification: {
        requiredBeforeWorkspaceAccess: true,
        persistenceRequired: "auth_core.email_verifications"
      },
      tenantScopedSession: {
        tenantHeader: TENANT_HEADER,
        workspaceHeader: WORKSPACE_HEADER,
        denyCrossTenantReplay: true
      },
      secureCookie: {
        ...defaultSecureCookieStrategy,
        domain: input.env.secureCookieDomain
      },
      auditLogging: {
        persistenceRequired: "auth_core.auth_audit_events",
        loginActivityRequired: true,
        suspiciousLoginDetectionRequired: true,
        impersonationAudited: true
      }
    }
  } as const;
}

function createTenantCorePayload(input: BusinessRouteInput) {
  return {
    status: "ok",
    module: "tenant-core",
    noMockTenant: true,
    registryRequired: true,
    runtime: createTenantRuntime(input),
    contracts: {
      tenantRegistry: "tenant_registry.tenants",
      tenantLifecycle: "tenant_registry.tenant_lifecycle_events",
      domainMapping: "tenant_registry.tenant_domains",
      workspaceRegistry: "tenant_registry.tenant_workspaces",
      featureFlags: "tenant_registry.tenant_feature_flags",
      limits: "tenant_registry.tenant_limits",
      branding: "tenant_registry.tenant_branding",
      localeCurrency: "tenant_registry.tenant_locale_currency",
      erpBridge: "tenant_registry.tenant_erp_bridges",
      commerceBridge: "tenant_registry.tenant_commerce_bridges"
    }
  } as const;
}

function createWorkspacePayload(input: BusinessRouteInput) {
  return {
    status: "ok",
    module: "workspace-system",
    tenantId: input.context.tenantId,
    workspaceId: input.context.workspaceId,
    workspaceTypes,
    isolationContracts: workspaceIsolationContracts,
    enforcedSurfaces: [
      "isolated navigation",
      "isolated permissions",
      "isolated widgets",
      "isolated notifications",
      "isolated realtime channels",
      "isolated layouts",
      "isolated commands",
      "isolated dashboards",
      "isolated queue visibility",
      "isolated AI context",
      "isolated activity streams",
      "isolated analytics"
    ],
    registryTable: "tenant_registry.tenant_workspaces"
  } as const;
}

function createEventSystemPayload(input: BusinessRouteInput) {
  const runtime = createTenantRuntime(input);

  return {
    status: "ok",
    module: "event-system",
    tenantId: runtime.tenantId,
    eventNamespace: runtime.serviceIsolation.eventNamespace,
    idempotencyHeader: defaultRetryPolicy.idempotencyKeyHeader,
    contracts: defaultEventContracts,
    retryPolicy: defaultRetryPolicy,
    deadLetterQueue: defaultDeadLetterQueue,
    replay: defaultEventReplay,
    realtimeSubscriptions: defaultRealtimeSubscriptions,
    persistence: {
      contracts: "event_core.event_contracts",
      outbox: "event_core.event_outbox",
      inbox: "event_core.event_inbox",
      deadLetters: "event_core.event_dead_letters",
      replayJobs: "event_core.event_replay_jobs",
      audit: "event_core.event_audit"
    }
  } as const;
}

function createBridgePayload(input: BusinessRouteInput, bridge: "odoo" | "medusa") {
  const runtime = createTenantRuntime(input);

  return {
    status: "ok",
    tenantId: runtime.tenantId,
    workspaceId: runtime.workspaceId,
    bridge,
    gatewayOnlyIngress: true,
    rawOdooUiAllowed: false,
    medusaAdminUiAllowed: false,
    tenantEventNamespace: runtime.serviceIsolation.eventNamespace,
    contract: bridge === "odoo" ? odooBridgeCoreContract : medusaCommerceCoreContract
  } as const;
}

function createControlCenterPayload(input: BusinessRouteInput) {
  return {
    status: "ok",
    module: "global-commerce-control-center",
    shell: {
      workspace: "central-admin",
      language: "tr-TR",
      logo: "large-responsive-premium",
      uiRole: "workspace-client",
      businessLogicLocation: "gateway/services/packages"
    },
    operationsCenter: {
      healthMatrix: input.healthMatrix,
      topology: createRuntimeTopologyPayload(),
      serviceDiscovery: input.registry,
      auth: authSummary(input.auth)
    },
    visibility: {
      tenantTopologyMap: true,
      syncTopology: true,
      eventFlow: true,
      queueVisibility: true,
      workerVisibility: true,
      aiOperationsDrawer: true,
      globalSearch: true,
      orchestrationCenter: true,
      erpHealth: true,
      commerceHealth: true,
      realtimeActivityStream: true,
      observabilityCenter: true,
      auditCenter: true,
      runtimeTopologyGraph: true
    }
  } as const;
}

function createRuntimeVerificationPayload(input: BusinessRouteInput) {
  return {
    status: "ok",
    verification: {
      route: {
        pathname: input.pathname,
        method: input.method,
        mounted: true
      },
      auth: authSummary(input.auth),
      tenantIsolation: createTenantRuntime(input),
      workspace: {
        workspaceId: input.context.workspaceId,
        knownWorkspaceTypes: workspaceTypes
      },
      event: {
        contractsMounted: defaultEventContracts.length,
        realtimeSubscriptionsMounted: defaultRealtimeSubscriptions.length,
        deadLetterQueueEnabled: true,
        replayEnabled: true
      },
      docker: {
        network: "commerce-os-network",
        services: input.registry.map((service) => ({
          service: service.name,
          layer: service.layer,
          criticality: service.criticality,
          probeType: service.probeType
        }))
      },
      commerce: {
        domains: defaultCommerceDomainBoundaries,
        odooBridgeOperations: odooBridgeCoreContract.operations,
        medusaOperations: medusaCommerceCoreContract.operations
      }
    }
  } as const;
}

export async function handleBusinessRoute(input: BusinessRouteInput): Promise<BusinessRouteResult> {
  if (input.method !== "GET") {
    return {
      statusCode: 405,
      payload: {
        status: "method_not_allowed",
        allowedMethods: ["GET"]
      }
    };
  }

  switch (input.pathname) {
    case "/v1/auth/core":
    case "/v1/auth/verify":
      return { statusCode: 200, payload: createAuthCorePayload(input) };
    case "/v1/tenants/isolation":
      return { statusCode: 200, payload: createTenantCorePayload(input) };
    case "/v1/workspaces/registry":
      return { statusCode: 200, payload: createWorkspacePayload(input) };
    case "/v1/events/contracts":
      return { statusCode: 200, payload: createEventSystemPayload(input) };
    case "/v1/bridges/odoo":
      return { statusCode: 200, payload: createBridgePayload(input, "odoo") };
    case "/v1/bridges/medusa":
      return { statusCode: 200, payload: createBridgePayload(input, "medusa") };
    case "/v1/control-center/health-matrix":
      return { statusCode: 200, payload: createControlCenterPayload(input) };
    case "/v1/runtime/verification":
      return { statusCode: 200, payload: createRuntimeVerificationPayload(input) };
    default:
      return {
        statusCode: 404,
        payload: {
          status: "business_route_not_found",
          message: "Mounted business core route bulunamadı.",
          availableRoutes: [
            "/v1/auth/core",
            "/v1/auth/verify",
            "/v1/tenants/isolation",
            "/v1/workspaces/registry",
            "/v1/events/contracts",
            "/v1/bridges/odoo",
            "/v1/bridges/medusa",
            "/v1/control-center/health-matrix",
            "/v1/runtime/verification"
          ]
        }
      };
  }
}
