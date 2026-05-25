export interface RuntimeEmptyState {
  readonly state?: string;
  readonly resource?: string;
  readonly reason?: string;
  readonly premiumEmptyState?: {
    readonly title: string;
    readonly message: string;
    readonly action: string;
  };
}

export interface RuntimeOperation {
  readonly operation?: string;
  readonly status?: string;
  readonly count?: number;
}

export interface OperationsCenterPayload {
  readonly status: string;
  readonly operationsCenter?: {
    readonly tenantTopologyMap?: readonly unknown[];
    readonly workspaceRegistry?: readonly { readonly workspace_id?: string; readonly workspace_type?: string; readonly enabled?: boolean }[];
    readonly runtimeTopologyGraph?: Record<string, unknown>;
    readonly syncTopologyGraph?: readonly unknown[];
    readonly realtimeEventStream?: readonly { readonly channel?: string; readonly subscriptionPath?: string }[];
    readonly queueMonitoring?: readonly unknown[];
    readonly workerMonitoring?: RuntimeEmptyState & Record<string, unknown>;
    readonly auditCenter?: readonly unknown[];
    readonly securityCenter?: Record<string, unknown>;
    readonly erpHealthCenter?: readonly RuntimeOperation[];
    readonly commerceHealthCenter?: readonly RuntimeOperation[];
    readonly orchestrationCenter?: {
      readonly odoo?: readonly RuntimeOperation[];
      readonly medusa?: readonly RuntimeOperation[];
    };
    readonly aiOperationsCenter?: {
      readonly contracts?: readonly string[];
      readonly signals?: readonly unknown[];
    };
    readonly billingVisibility?: RuntimeEmptyState & Record<string, unknown>;
    readonly tenantLifecycleVisibility?: readonly unknown[];
  };
  readonly emptyState?: RuntimeEmptyState;
  readonly correlationId?: string;
  readonly traceId?: string;
}

export async function fetchOperationsCenter(): Promise<OperationsCenterPayload> {
  const gatewayUrl = process.env.CENTRAL_ADMIN_GATEWAY_URL;
  const serviceToken = process.env.CENTRAL_ADMIN_GATEWAY_SERVICE_TOKEN;
  const tenantId = process.env.CENTRAL_ADMIN_TENANT_ID;
  const workspaceId = process.env.CENTRAL_ADMIN_WORKSPACE_ID ?? "central-admin";

  if (!gatewayUrl || !serviceToken || !tenantId) {
    return {
      status: "configuration_required",
      emptyState: {
        state: "empty_operational_state",
        resource: "control-center.operations",
        reason: "gateway_runtime_configuration_missing",
        premiumEmptyState: {
          title: "Runtime bağlantısı bekleniyor",
          message: "Bu ekran demo veri üretmez. Gateway service token ve tenant bağlamı tanımlandığında gerçek operasyon verisiyle beslenir.",
          action: "CENTRAL_ADMIN_GATEWAY_URL, CENTRAL_ADMIN_GATEWAY_SERVICE_TOKEN ve CENTRAL_ADMIN_TENANT_ID değerlerini bağlayın."
        }
      }
    };
  }

  try {
    const response = await fetch(`${gatewayUrl.replace(/\/$/, "")}/v1/control-center/operations`, {
      cache: "no-store",
      headers: {
        "x-commerce-service-token": serviceToken,
        "x-commerce-tenant": tenantId,
        "x-commerce-workspace": workspaceId
      }
    });

    if (!response.ok) {
      return {
        status: "gateway_rejected",
        emptyState: {
          state: "empty_operational_state",
          resource: "control-center.operations",
          reason: `gateway_http_${response.status}`,
          premiumEmptyState: {
            title: "Gateway runtime erişimi doğrulanamadı",
            message: "Kontrol merkezi sahte veri göstermedi. Gateway auth veya tenant/workspace boundary yanıtı bekleniyor.",
            action: "Gateway auth headerlarını ve tenant workspace scope değerlerini kontrol edin."
          }
        }
      };
    }

    return (await response.json()) as OperationsCenterPayload;
  } catch {
    return {
      status: "gateway_unavailable",
      emptyState: {
        state: "empty_operational_state",
        resource: "control-center.operations",
        reason: "gateway_unavailable",
        premiumEmptyState: {
          title: "Gateway runtime çevrimdışı",
          message: "Gerçek operasyon verisi alınamadı; bu yüzey boş dashboard üretmez.",
          action: "Gateway API servisini başlatın ve tekrar yükleyin."
        }
      }
    };
  }
}
