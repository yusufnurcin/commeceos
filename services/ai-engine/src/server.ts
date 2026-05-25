import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { defaultRetryPolicy } from "@commerce-os/sync-core";

const serviceName = "ai-engine";
const port = Number(process.env.PORT ?? 8093);

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
      layer: "ai-orchestration-foundation",
      providersConfigured: false,
      businessToolsMounted: false
    });
    return;
  }

  if (request.method === "GET" && request.url === "/runtime/queues") {
    writeJson(response, 200, {
      status: "ok",
      queues: [
        {
          queueName: "commerce-os.ai",
          redisDatabase: 7,
          streamName: "stream:ai",
          deadLetterStreamName: "stream:ai:dlq",
          idempotencyRequired: true,
          retryPolicy: defaultRetryPolicy
        }
      ]
    });
    return;
  }

  writeJson(response, 404, { status: "not_found", service: serviceName });
});

server.listen(port, () => {
  log("service_started", { port });
});
