import { AUTHORIZATION_HEADER, SERVICE_TOKEN_HEADER } from "@commerce-os/auth-core";
import { TENANT_HEADER, WORKSPACE_HEADER } from "@commerce-os/tenant-core";
import type { ServiceRegistryEntry } from "../runtime/service-registry";

export function createGatewayHealthPayload(registry: readonly ServiceRegistryEntry[]) {
  return {
    status: "ok",
    service: "gateway-api",
    layer: "api-gateway",
    businessRoutesEnabled: true,
    businessCorePhase: "auth-tenant-workspace-event-bridge-control-center",
    operationalRuntimeEnabled: true,
    rawOdooUiExposed: false,
    requiredHeaders: {
      authorization: AUTHORIZATION_HEADER,
      serviceToken: SERVICE_TOKEN_HEADER,
      tenant: TENANT_HEADER,
      workspace: WORKSPACE_HEADER
    },
    serviceDiscovery: registry.map((service) => ({
      service: service.name,
      discoveryName: service.discoveryName,
      layer: service.layer,
      criticality: service.criticality
    }))
  } as const;
}
