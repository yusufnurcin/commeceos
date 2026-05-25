import type { TenantContext } from "@commerce-os/tenant-core";

export type AnalyticsEventSource = "gateway-api" | "experience-app" | "service" | "erp-sync";
export type AuditActionResult = "accepted" | "rejected" | "failed";
export type AuditActorType = "principal" | "service" | "system";

export interface AnalyticsEventEnvelope<TPayload = unknown> {
  readonly eventId: string;
  readonly tenant: TenantContext;
  readonly source: AnalyticsEventSource;
  readonly occurredAt: string;
  readonly payload: TPayload;
}

export interface AuditLogContract<TPayload = unknown> {
  readonly auditId: string;
  readonly tenant?: TenantContext;
  readonly actorType: AuditActorType;
  readonly actorId: string;
  readonly action: string;
  readonly resource: string;
  readonly result: AuditActionResult;
  readonly correlationId: string;
  readonly traceId: string;
  readonly occurredAt: string;
  readonly payload?: TPayload;
}
