export type TenantIsolationMode = "database-per-tenant" | "schema-per-tenant" | "row-level-security";
export type TenantLifecycleState = "provisioning" | "active" | "suspended" | "archived";
export type WorkspaceType =
  | "central-admin"
  | "tenant-admin"
  | "seller-workspace"
  | "customer-workspace"
  | "courier-workspace"
  | "finance-workspace"
  | "accounting-workspace"
  | "marketing-workspace"
  | "support-workspace"
  | "warehouse-workspace"
  | "procurement-workspace"
  | "service";
export type DataResidencyMode = "single-region" | "country-bound" | "multi-region";
export type TenantMiddlewareScope = "request" | "service" | "event" | "cache" | "storage" | "queue";
export type WorkspaceSurface =
  | "navigation"
  | "permissions"
  | "widgets"
  | "notifications"
  | "realtime-channels"
  | "layouts"
  | "commands"
  | "dashboards"
  | "queue-visibility"
  | "ai-context"
  | "activity-streams"
  | "analytics";

export interface TenantContext {
  readonly tenantId: string;
  readonly isolationMode: TenantIsolationMode;
  readonly lifecycleState: TenantLifecycleState;
  readonly countryCode?: string;
  readonly defaultCurrency?: string;
  readonly odooCompanyId?: string;
}

export interface WorkspaceContext {
  readonly workspaceId: string;
  readonly workspaceType: WorkspaceType;
  readonly tenantId?: string;
  readonly isolatedByTenant: boolean;
}

export interface TenantResolutionRequest {
  readonly host?: string;
  readonly tenantHeader?: string;
  readonly workspaceId?: string;
}

export interface TenantRegistryEntry {
  readonly tenantId: string;
  readonly lifecycleState: TenantLifecycleState;
  readonly isolationMode: TenantIsolationMode;
  readonly defaultLocale: string;
  readonly defaultCurrency: string;
  readonly primaryDomain?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TenantDomainMapping {
  readonly tenantId: string;
  readonly host: string;
  readonly verified: boolean;
  readonly sslRequired: true;
  readonly workspaceType?: WorkspaceType;
}

export interface TenantWorkspaceRegistryEntry {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly workspaceType: WorkspaceType;
  readonly enabled: boolean;
  readonly roleIds: readonly string[];
}

export interface TenantFeatureFlag {
  readonly tenantId: string;
  readonly flagKey: string;
  readonly enabled: boolean;
  readonly rolloutStrategy: "all" | "role" | "workspace" | "percentage";
}

export interface TenantLimitsContract {
  readonly tenantId: string;
  readonly maxWorkspaces: number;
  readonly maxUsers: number;
  readonly maxStorageGb: number;
  readonly maxEventsPerMinute: number;
  readonly maxQueueDepth: number;
}

export interface TenantBrandingContract {
  readonly tenantId: string;
  readonly logoAssetKey?: string;
  readonly brandName: string;
  readonly colorTokens: Record<string, string>;
  readonly customDomainRequiredForPublicBranding: true;
}

export interface TenantLocaleCurrencyContract {
  readonly tenantId: string;
  readonly defaultLocale: string;
  readonly supportedLocales: readonly string[];
  readonly defaultCurrency: string;
  readonly supportedCurrencies: readonly string[];
  readonly timezone: string;
}

export interface TenantBridgeContract {
  readonly tenantId: string;
  readonly engine: "odoo" | "medusa";
  readonly bridgeId: string;
  readonly enabled: boolean;
  readonly tenantScoped: true;
  readonly directUiAllowed: false;
}

export interface TenantIsolationPlan {
  readonly tenantId: string;
  readonly isolationMode: TenantIsolationMode;
  readonly dataResidencyMode: DataResidencyMode;
  readonly postgresDatabase?: string;
  readonly postgresSchema?: string;
  readonly redisKeyPrefix: string;
  readonly minioBucketPrefix: string;
  readonly meilisearchIndexPrefix: string;
  readonly cacheNamespace: string;
  readonly queueNamespace: string;
  readonly eventNamespace: string;
  readonly storageNamespace: string;
}

export interface TenantErpIsolationPlan {
  readonly tenantId: string;
  readonly odooDatabase: string;
  readonly odooCompanyIds: readonly string[];
  readonly countryCode: string;
  readonly localizationPack: string;
  readonly fiscalLocalizationRequired: true;
}

export interface TenantCommerceIsolationPlan {
  readonly tenantId: string;
  readonly medusaRegionScope: string;
  readonly catalogScope: string;
  readonly priceListScope: string;
  readonly taxRegionScope: string;
  readonly adminUiAllowed: false;
}

export interface TenantIsolationBoundary {
  readonly tenantId: string;
  readonly middlewareScopes: readonly TenantMiddlewareScope[];
  readonly isolationPlan: TenantIsolationPlan;
  readonly erpPlan: TenantErpIsolationPlan;
  readonly commercePlan: TenantCommerceIsolationPlan;
}

export interface WorkspaceIsolationContract {
  readonly workspaceType: WorkspaceType;
  readonly surfaces: readonly WorkspaceSurface[];
  readonly requiredPermissions: readonly string[];
  readonly realtimeChannelPrefix: string;
  readonly commandPrefix: string;
  readonly queueVisibilityScope: string;
  readonly aiContextScope: string;
  readonly analyticsScope: string;
}

export const TENANT_HEADER = "x-commerce-tenant";
export const WORKSPACE_HEADER = "x-commerce-workspace";
export const TENANT_REGION_HEADER = "x-commerce-tenant-region";

export const tenantMiddlewareScopes: readonly TenantMiddlewareScope[] = [
  "request",
  "service",
  "event",
  "cache",
  "storage",
  "queue"
];

export const workspaceSurfaces: readonly WorkspaceSurface[] = [
  "navigation",
  "permissions",
  "widgets",
  "notifications",
  "realtime-channels",
  "layouts",
  "commands",
  "dashboards",
  "queue-visibility",
  "ai-context",
  "activity-streams",
  "analytics"
];

export const workspaceTypes: readonly WorkspaceType[] = [
  "central-admin",
  "tenant-admin",
  "seller-workspace",
  "customer-workspace",
  "courier-workspace",
  "finance-workspace",
  "accounting-workspace",
  "marketing-workspace",
  "support-workspace",
  "warehouse-workspace",
  "procurement-workspace"
];

export const workspaceIsolationContracts: readonly WorkspaceIsolationContract[] = workspaceTypes.map((workspaceType) => ({
  workspaceType,
  surfaces: workspaceSurfaces,
  requiredPermissions: [`workspace.${workspaceType}.access`],
  realtimeChannelPrefix: `workspace:${workspaceType}`,
  commandPrefix: `command:${workspaceType}`,
  queueVisibilityScope: `queue:${workspaceType}`,
  aiContextScope: `ai:${workspaceType}`,
  analyticsScope: `analytics:${workspaceType}`
}));

export function createTenantIsolationPlan(
  tenantId: string,
  isolationMode: TenantIsolationMode = "schema-per-tenant",
  dataResidencyMode: DataResidencyMode = "country-bound"
): TenantIsolationPlan {
  const normalizedTenantId = tenantId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");

  return {
    tenantId,
    isolationMode,
    dataResidencyMode,
    postgresSchema: `tenant_${normalizedTenantId}`,
    redisKeyPrefix: `tenant:${normalizedTenantId}`,
    minioBucketPrefix: `tenant-${normalizedTenantId}`,
    meilisearchIndexPrefix: `tenant_${normalizedTenantId}`,
    cacheNamespace: `cache:tenant:${normalizedTenantId}`,
    queueNamespace: `queue:tenant:${normalizedTenantId}`,
    eventNamespace: `event:tenant:${normalizedTenantId}`,
    storageNamespace: `storage/tenant/${normalizedTenantId}`
  };
}
