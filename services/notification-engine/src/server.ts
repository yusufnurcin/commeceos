import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { defaultDeadLetterQueue, defaultEventContracts, defaultRetryPolicy } from "@commerce-os/sync-core";

const serviceName = "notification-engine";
const port = Number(process.env.PORT ?? 8094);

function log(message: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), service: serviceName, message, ...details }));
}

function writeJson(response: import("node:http").ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

const server = createServer((request, response) => {
  const correlationId = request.headers["x-correlation-id"] ?? randomUUID();
  response.setHeader("x-correlation-id", String(correlationId));
  log("request_received", { method: request.method, url: request.url, correlationId });

  if (request.method === "GET" && (request.url === "/health" || request.url === "/ready")) {
    writeJson(response, 200, {
      status: request.url === "/ready" ? "ready" : "ok",
      service: serviceName,
      layer: "notification-orchestration",
      channelsMounted: true,
      redisUrlConfigured: Boolean(process.env.REDIS_URL)
    });
    return;
  }

  if (request.method === "GET" && request.url === "/runtime/queues") {
    writeJson(response, 200, {
      status: "ok",
      queues: [
        {
          queueName: "commerce-os.notification",
          redisDatabase: 6,
          streamName: "stream:notification",
          deadLetterStreamName: "stream:notification:dlq",
          idempotencyRequired: true,
          retryPolicy: defaultRetryPolicy
        }
      ],
      eventContracts: defaultEventContracts
        .filter((contract) => contract.domain === "notification")
        .map((contract) => contract.eventName),
      deadLetterQueue: defaultDeadLetterQueue
    });
    return;
  }

  writeJson(response, 404, { status: "not_found", service: serviceName });
});

server.listen(port, () => {
  log("service_started", { port });
});
