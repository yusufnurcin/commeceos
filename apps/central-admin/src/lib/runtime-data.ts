import type { NavigationItem } from "@/config/navigation";
import { gatewayFetchWithRefresh, getGatewayUrl } from "@/lib/gateway-session";
import type { DemoStatusView } from "@/components/demo-center-panel";

export type JsonRecord = Record<string, unknown>;

export interface CurrentSessionPayload {
  readonly status?: string;
  readonly principal?: {
    readonly principalId?: string;
    readonly principalType?: string;
    readonly email?: string | null;
    readonly name?: string | null;
    readonly tenantId?: string;
    readonly workspaceId?: string;
    readonly roles?: readonly string[];
    readonly permissions?: readonly string[];
  };
  readonly session?: {
    readonly sessionId?: string;
    readonly status?: string;
    readonly deviceId?: string;
  };
}

export interface DashboardRuntimePayload {
  readonly status: string;
  readonly me?: CurrentSessionPayload;
  readonly healthMatrix?: {
    readonly status?: string;
    readonly entries?: readonly {
      readonly service?: string;
      readonly layer?: string;
      readonly status?: string;
      readonly latencyMs?: number;
      readonly checkedAt?: string;
    }[];
  };
  readonly medusaHealth?: JsonRecord;
  readonly operations?: JsonRecord;
  readonly tenants?: { readonly tenants?: readonly JsonRecord[] };
  readonly queue?: { readonly queueStates?: readonly JsonRecord[]; readonly deadLetters?: readonly JsonRecord[] };
  readonly audit?: {
    readonly events?: readonly {
      readonly audit_id?: string;
      readonly action?: string;
      readonly result?: string;
      readonly occurred_at?: string;
      readonly tenant_id?: string;
      readonly workspace_id?: string;
    }[];
  };
  readonly demo?: DemoStatusView;
}

export async function readJson(response: Response): Promise<JsonRecord> {
  return response.json().catch(() => ({ status: "payload_unavailable" })) as Promise<JsonRecord>;
}

export async function getCurrentSession() {
  const response = await gatewayFetchWithRefresh("/v1/auth/me", {}, { allowCookieMutation: false });
  if (!response.ok) {
    return null;
  }
  return (await response.json().catch(() => null)) as CurrentSessionPayload | null;
}

export async function getDashboardRuntime(): Promise<DashboardRuntimePayload> {
  const meResponse = await gatewayFetchWithRefresh("/v1/auth/me", {}, { allowCookieMutation: false });
  if (!meResponse.ok) {
    return { status: "auth_required" };
  }

  const [me, healthMatrix, operations, tenants, queue, audit, medusaHealth, demo] = await Promise.all([
    meResponse.json().catch(() => ({ status: "me_unavailable" })) as Promise<CurrentSessionPayload>,
    fetch(`${getGatewayUrl()}/runtime/health-matrix`, { cache: "no-store" }).then(readJson),
    gatewayFetchWithRefresh("/v1/control-center/operations", {}, { allowCookieMutation: false }).then(readJson),
    gatewayFetchWithRefresh("/v1/tenants", {}, { allowCookieMutation: false }).then(readJson),
    gatewayFetchWithRefresh("/v1/queues/runtime", {}, { allowCookieMutation: false }).then(readJson),
    gatewayFetchWithRefresh("/v1/audit/runtime", {}, { allowCookieMutation: false }).then(readJson),
    fetch(`${process.env.MEDUSA_PUBLIC_URL ?? "http://localhost:9000"}/health`, { cache: "no-store" }).then(readJson),
    gatewayFetchWithRefresh("/v1/demo/status", {}, { allowCookieMutation: false }).then(readJson)
  ]);

  return {
    status: "ok",
    me,
    healthMatrix,
    operations,
    tenants,
    queue,
    audit,
    medusaHealth,
    demo: demo as unknown as DemoStatusView
  } as DashboardRuntimePayload;
}

export async function getConnectedRuntimePayload(item: NavigationItem) {
  if (!item.connectedRuntime) {
    return null;
  }

  if (item.connectedRuntime === "medusa:/health") {
    return fetch(`${process.env.MEDUSA_PUBLIC_URL ?? "http://localhost:9000"}/health`, { cache: "no-store" }).then(readJson);
  }

  if (item.connectedRuntime.startsWith("/runtime/")) {
    return fetch(`${getGatewayUrl()}${item.connectedRuntime}`, { cache: "no-store" }).then(readJson);
  }

  if (item.connectedRuntime.startsWith("/v1/")) {
    const response = await gatewayFetchWithRefresh(item.connectedRuntime, {}, { allowCookieMutation: false });
    return readJson(response);
  }

  if (item.connectedRuntime === "/health") {
    return fetch(`${getGatewayUrl()}/health`, { cache: "no-store" }).then(readJson);
  }

  return null;
}
