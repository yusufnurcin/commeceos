import type { TenantContext } from "@commerce-os/tenant-core";

export type ExternalSystem = "odoo" | "medusa" | "meilisearch" | "minio";
export type SyncDirection = "inbound" | "outbound" | "bidirectional";
export type SyncExecutionMode = "realtime" | "scheduled" | "manual";
export type RuntimeEventChannel =
  | "workflow"
  | "sync"
  | "erp-bridge"
  | "commerce"
  | "order"
  | "inventory"
  | "finance"
  | "notification"
  | "ai"
  | "audit";
export type RetryBackoffStrategy = "fixed" | "exponential" | "decorrelated-jitter";
export type QueuePriority = "critical" | "high" | "normal" | "low";
export type EventContractDomain = "workflow" | "sync" | "erp-bridge" | "commerce" | "notification" | "audit";
export type EventDeliveryState = "pending" | "published" | "consumed" | "retrying" | "dead-lettered" | "replayed";

export interface SyncCheckpoint {
  readonly tenant: TenantContext;
  readonly system: ExternalSystem;
  readonly cursor: string;
  readonly capturedAt: string;
}

export interface SyncJobEnvelope<TPayload = unknown> {
  readonly syncJobId: string;
  readonly tenant: TenantContext;
  readonly source: ExternalSystem;
  readonly target: ExternalSystem;
  readonly direction: SyncDirection;
  readonly mode: SyncExecutionMode;
  readonly payload: TPayload;
}

export interface QueueContract {
  readonly queueName: string;
  readonly redisDatabase: number;
  readonly streamName: string;
  readonly deadLetterStreamName: string;
  readonly priority: QueuePriority;
  readonly idempotencyRequired: true;
}

export interface EventBusContract {
  readonly channel: RuntimeEventChannel;
  readonly redisStream: string;
  readonly tenantScoped: true;
  readonly replaySupported: true;
}

export interface EventVersionContract {
  readonly name: string;
  readonly currentVersion: number;
  readonly minimumSupportedVersion: number;
  readonly compatibility: "backward-compatible" | "strict";
}

export interface EventContract {
  readonly eventName: string;
  readonly domain: EventContractDomain;
  readonly version: EventVersionContract;
  readonly tenantScoped: true;
  readonly workspaceScoped: boolean;
  readonly idempotencyRequired: true;
  readonly auditRequired: true;
  readonly realtimeFanout: boolean;
  readonly payloadSchemaRef: string;
  readonly samplePayload?: never;
}

export interface EventEnvelope<TPayload = unknown> {
  readonly eventId: string;
  readonly eventName: string;
  readonly eventVersion: number;
  readonly tenant: TenantContext;
  readonly workspaceId?: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly occurredAt: string;
  readonly payload: TPayload;
}

export interface EventRetryTopology {
  readonly retryStream: string;
  readonly deadLetterStream: string;
  readonly maxAttempts: number;
  readonly backoffStrategy: RetryBackoffStrategy;
  readonly poisonMessageQuarantine: true;
}

export interface DeadLetterQueueContract {
  readonly streamName: string;
  readonly replayRequiresOperatorApproval: true;
  readonly storesFailureReason: true;
  readonly storesOriginalEnvelope: true;
}

export interface EventReplayContract {
  readonly replayIdHeader: "x-commerce-replay-id";
  readonly requiresIdempotencyKey: true;
  readonly preservesOriginalOccurredAt: true;
  readonly audited: true;
}

export interface RealtimeSubscriptionContract {
  readonly channel: RuntimeEventChannel;
  readonly tenantScoped: true;
  readonly workspaceScoped: boolean;
  readonly subscriptionPath: string;
  readonly authRequired: true;
}

export interface RetryPolicyContract {
  readonly maxAttempts: number;
  readonly backoffStrategy: RetryBackoffStrategy;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly idempotencyKeyHeader: string;
}

export interface ErpBridgeContract {
  readonly bridgeId: string;
  readonly erpEngine: "odoo";
  readonly tenantScoped: true;
  readonly companyScoped: true;
  readonly allowedModules: readonly string[];
  readonly rawOdooUiAllowed: false;
}

export const runtimeEventChannels: readonly RuntimeEventChannel[] = [
  "workflow",
  "sync",
  "erp-bridge",
  "commerce",
  "order",
  "inventory",
  "finance",
  "notification",
  "ai",
  "audit"
];

export const defaultRetryPolicy: RetryPolicyContract = {
  maxAttempts: 3,
  backoffStrategy: "decorrelated-jitter",
  baseDelayMs: 250,
  maxDelayMs: 5000,
  idempotencyKeyHeader: "idempotency-key"
};

export const defaultEventContracts: readonly EventContract[] = [
  {
    eventName: "workflow.command.accepted",
    domain: "workflow",
    version: {
      name: "workflow-command",
      currentVersion: 1,
      minimumSupportedVersion: 1,
      compatibility: "backward-compatible"
    },
    tenantScoped: true,
    workspaceScoped: true,
    idempotencyRequired: true,
    auditRequired: true,
    realtimeFanout: true,
    payloadSchemaRef: "schema://events/workflow.command.accepted.v1"
  },
  {
    eventName: "sync.job.requested",
    domain: "sync",
    version: {
      name: "sync-job",
      currentVersion: 1,
      minimumSupportedVersion: 1,
      compatibility: "backward-compatible"
    },
    tenantScoped: true,
    workspaceScoped: false,
    idempotencyRequired: true,
    auditRequired: true,
    realtimeFanout: true,
    payloadSchemaRef: "schema://events/sync.job.requested.v1"
  },
  {
    eventName: "erp.bridge.operation.requested",
    domain: "erp-bridge",
    version: {
      name: "erp-bridge-operation",
      currentVersion: 1,
      minimumSupportedVersion: 1,
      compatibility: "strict"
    },
    tenantScoped: true,
    workspaceScoped: true,
    idempotencyRequired: true,
    auditRequired: true,
    realtimeFanout: true,
    payloadSchemaRef: "schema://events/erp.bridge.operation.requested.v1"
  },
  {
    eventName: "commerce.orchestration.requested",
    domain: "commerce",
    version: {
      name: "commerce-orchestration",
      currentVersion: 1,
      minimumSupportedVersion: 1,
      compatibility: "strict"
    },
    tenantScoped: true,
    workspaceScoped: true,
    idempotencyRequired: true,
    auditRequired: true,
    realtimeFanout: true,
    payloadSchemaRef: "schema://events/commerce.orchestration.requested.v1"
  },
  {
    eventName: "notification.dispatch.requested",
    domain: "notification",
    version: {
      name: "notification-dispatch",
      currentVersion: 1,
      minimumSupportedVersion: 1,
      compatibility: "backward-compatible"
    },
    tenantScoped: true,
    workspaceScoped: true,
    idempotencyRequired: true,
    auditRequired: true,
    realtimeFanout: true,
    payloadSchemaRef: "schema://events/notification.dispatch.requested.v1"
  }
];

export const defaultDeadLetterQueue: DeadLetterQueueContract = {
  streamName: "stream:dead-letter",
  replayRequiresOperatorApproval: true,
  storesFailureReason: true,
  storesOriginalEnvelope: true
};

export const defaultEventReplay: EventReplayContract = {
  replayIdHeader: "x-commerce-replay-id",
  requiresIdempotencyKey: true,
  preservesOriginalOccurredAt: true,
  audited: true
};

export const defaultRealtimeSubscriptions: readonly RealtimeSubscriptionContract[] = runtimeEventChannels.map((channel) => ({
  channel,
  tenantScoped: true,
  workspaceScoped: channel !== "sync" && channel !== "erp-bridge",
  subscriptionPath: `/v1/realtime/${channel}`,
  authRequired: true
}));
