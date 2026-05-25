import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const serviceName = "search";
const port = Number(process.env.PORT ?? 8092);

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
      layer: "search-foundation",
      indexesProvisioned: false,
      meiliHostConfigured: Boolean(process.env.MEILI_HOST)
    });
    return;
  }

  writeJson(response, 404, { status: "not_found", service: serviceName });
});

server.listen(port, () => {
  log("service_started", { port });
});
