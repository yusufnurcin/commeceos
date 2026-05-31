export type ServiceProbeType = "http" | "tcp";
export type ServiceCriticality = "critical" | "supporting" | "future";

export interface ServiceRegistryEntry {
  readonly name: string;
  readonly layer: string;
  readonly discoveryName: string;
  readonly probeType: ServiceProbeType;
  readonly healthUrl?: string;
  readonly host?: string;
  readonly port?: number;
  readonly criticality: ServiceCriticality;
  readonly exposedToPlatformUsers: false;
}

export interface ServiceRegistryInput {
  readonly postgresHost: string;
  readonly postgresPort: number;
  readonly redisHost: string;
  readonly redisPort: number;
  readonly minioUrl: string;
  readonly meiliUrl: string;
  readonly medusaUrl: string;
  readonly odooHost: string;
  readonly odooPort: number;
  readonly gatewayUrl: string;
  readonly realtimeUrl: string;
  readonly searchUrl: string;
  readonly notificationUrl: string;
  readonly aiEngineUrl: string;
}

export function createServiceRegistry(input: ServiceRegistryInput): readonly ServiceRegistryEntry[] {
  return [
    {
      name: "postgres",
      layer: "state",
      discoveryName: input.postgresHost,
      probeType: "tcp",
      host: input.postgresHost,
      port: input.postgresPort,
      criticality: "critical",
      exposedToPlatformUsers: false
    },
    {
      name: "redis",
      layer: "cache-queue-event-bus",
      discoveryName: input.redisHost,
      probeType: "tcp",
      host: input.redisHost,
      port: input.redisPort,
      criticality: "critical",
      exposedToPlatformUsers: false
    },
    {
      name: "minio",
      layer: "object-storage",
      discoveryName: "minio",
      probeType: "http",
      healthUrl: `${input.minioUrl}/minio/health/live`,
      criticality: "critical",
      exposedToPlatformUsers: false
    },
    {
      name: "meilisearch",
      layer: "search-index",
      discoveryName: "meilisearch",
      probeType: "http",
      healthUrl: `${input.meiliUrl}/health`,
      criticality: "supporting",
      exposedToPlatformUsers: false
    },
    {
      name: "odoo",
      layer: "erp-engine",
      discoveryName: input.odooHost,
      probeType: "tcp",
      host: input.odooHost,
      port: input.odooPort,
      criticality: "critical",
      exposedToPlatformUsers: false
    },
    {
      name: "medusa",
      layer: "optional-commerce-provider-bridge",
      discoveryName: "medusa",
      probeType: "http",
      healthUrl: `${input.medusaUrl}/health`,
      criticality: "supporting",
      exposedToPlatformUsers: false
    },
    {
      name: "gateway-api",
      layer: "api-gateway",
      discoveryName: "gateway-api",
      probeType: "http",
      healthUrl: `${input.gatewayUrl}/health`,
      criticality: "critical",
      exposedToPlatformUsers: false
    },
    {
      name: "realtime",
      layer: "event-fanout",
      discoveryName: "realtime",
      probeType: "http",
      healthUrl: `${input.realtimeUrl}/health`,
      criticality: "supporting",
      exposedToPlatformUsers: false
    },
    {
      name: "search",
      layer: "search-orchestration",
      discoveryName: "search",
      probeType: "http",
      healthUrl: `${input.searchUrl}/health`,
      criticality: "supporting",
      exposedToPlatformUsers: false
    },
    {
      name: "notification-engine",
      layer: "notification-orchestration",
      discoveryName: "notification-engine",
      probeType: "http",
      healthUrl: `${input.notificationUrl}/health`,
      criticality: "supporting",
      exposedToPlatformUsers: false
    },
    {
      name: "ai-engine",
      layer: "ai-orchestration",
      discoveryName: "ai-engine",
      probeType: "http",
      healthUrl: `${input.aiEngineUrl}/health`,
      criticality: "future",
      exposedToPlatformUsers: false
    }
  ];
}
