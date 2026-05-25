import { defaultCommerceDomainBoundaries } from "@commerce-os/commerce-core";
import {
  defaultDeadLetterQueue,
  defaultEventContracts,
  defaultEventReplay,
  defaultRealtimeSubscriptions,
  defaultRetryPolicy,
  runtimeEventChannels,
  type QueueContract
} from "@commerce-os/sync-core";

export const queueTopology: readonly QueueContract[] = [
  {
    queueName: "commerce-os.sync",
    redisDatabase: 5,
    streamName: "stream:sync",
    deadLetterStreamName: "stream:sync:dlq",
    priority: "high",
    idempotencyRequired: true
  },
  {
    queueName: "commerce-os.notification",
    redisDatabase: 6,
    streamName: "stream:notification",
    deadLetterStreamName: "stream:notification:dlq",
    priority: "normal",
    idempotencyRequired: true
  },
  {
    queueName: "commerce-os.ai",
    redisDatabase: 7,
    streamName: "stream:ai",
    deadLetterStreamName: "stream:ai:dlq",
    priority: "low",
    idempotencyRequired: true
  }
];

export function createRuntimeTopologyPayload() {
  return {
    commerceDomains: defaultCommerceDomainBoundaries,
    eventContracts: defaultEventContracts,
    eventChannels: runtimeEventChannels.map((channel) => ({
      channel,
      redisStream: `stream:${channel}`,
      tenantScoped: true,
      replaySupported: true
    })),
    realtimeSubscriptions: defaultRealtimeSubscriptions,
    queues: queueTopology,
    retryPolicy: defaultRetryPolicy,
    deadLetterQueue: defaultDeadLetterQueue,
    eventReplay: defaultEventReplay
  };
}
