import { randomUUID } from "node:crypto";
import { createServer, type ServerResponse } from "node:http";
import type { AuditLogContract } from "@commerce-os/analytics-core";
import { readGatewayEnvironment } from "./config/env";
import { handleBusinessRoute } from "./http/business-core";
import { createGatewayHealthPayload } from "./http/health";
import { handleOperationalRoute, isOperationalRuntimeRoute } from "./http/operational-runtime";
import { readJsonBody } from "./http/request-body";
import { createRuntimeTopologyPayload } from "./http/topology";
import { validateTenantWorkspaceScope, verifyGatewayAuth } from "./runtime/auth-verifier";
import { createRuntimeDatabase } from "./runtime/db";
import { createHealthMatrix } from "./runtime/health-matrix";
import { log } from "./runtime/logger";
import { checkRateLimit } from "./runtime/rate-limit";
import { createRequestContext } from "./runtime/request-context";
import { foundationAccessPolicy, hybridAuthBoundary } from "./runtime/security-boundaries";
import { createServiceRegistry } from "./runtime/service-registry";

const env = readGatewayEnvironment();
const serviceName = "gateway-api";
const db = createRuntimeDatabase(env);
const registry = createServiceRegistry({
  postgresHost: env.postgresHost,
  postgresPort: env.postgresPort,
  redisHost: env.redisHost,
  redisPort: env.redisPort,
  minioUrl: env.minioUrl,
  meiliUrl: env.meiliUrl,
  medusaUrl: env.medusaUrl,
  odooHost: env.odooHost,
  odooPort: env.odooPort,
  gatewayUrl: env.gatewayUrl,
  realtimeUrl: env.realtimeUrl,
  searchUrl: env.searchUrl,
  notificationUrl: env.notificationUrl,
  aiEngineUrl: env.aiEngineUrl
});

function writeJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

function writeAudit(action: string, result: AuditLogContract["result"], context: ReturnType<typeof createRequestContext>) {
  const audit: AuditLogContract = {
    auditId: randomUUID(),
    actorType: context.authMechanism === "service-token" ? "service" : "principal",
    actorId: context.authMechanism ?? "anonymous",
    action,
    resource: "gateway-api",
    result,
    correlationId: context.correlationId,
    traceId: context.traceId,
    occurredAt: new Date().toISOString()
  };

  log(result === "failed" ? "error" : "info", "audit", { service: serviceName, ...context }, { audit });
}

const server = createServer(async (request, response) => {
  const context = createRequestContext(request);
  const pathname = new URL(request.url ?? "/", env.gatewayUrl).pathname;
  response.setHeader("x-correlation-id", context.correlationId);
  response.setHeader("x-trace-id", context.traceId);

  const rateLimitKey = `${context.tenantId ?? "anonymous"}:${request.socket.remoteAddress ?? "unknown"}`;
  const rateLimit = checkRateLimit(rateLimitKey, env.rateLimitMaxRequests, env.rateLimitWindowMs);
  response.setHeader("x-ratelimit-limit", String(rateLimit.limit));
  response.setHeader("x-ratelimit-remaining", String(rateLimit.remaining));
  response.setHeader("x-ratelimit-reset", String(rateLimit.resetAt));

  if (!rateLimit.allowed) {
    writeAudit("gateway.rate_limit", "rejected", context);
    writeJson(response, 429, {
      status: "rate_limited",
      correlationId: context.correlationId,
      traceId: context.traceId
    });
    return;
  }

  log("info", "request_received", { service: serviceName, ...context }, { method: request.method, url: request.url });

  if (request.method === "GET" && pathname === "/health") {
    writeJson(response, 200, createGatewayHealthPayload(registry));
    return;
  }

  if (request.method === "GET" && pathname === "/ready") {
    const matrix = await createHealthMatrix(registry.filter((service) => service.name !== "gateway-api"));
    writeJson(response, matrix.status === "ready" ? 200 : 503, {
      status: matrix.status,
      service: serviceName,
      correlationId: context.correlationId,
      traceId: context.traceId,
      criticalFailures: matrix.criticalFailures
    });
    return;
  }

  if (request.method === "GET" && pathname === "/runtime/health-matrix") {
    writeJson(response, 200, await createHealthMatrix(registry));
    return;
  }

  if (request.method === "GET" && pathname === "/runtime/service-discovery") {
    writeJson(response, 200, {
      status: "ok",
      network: "commerce-os-network",
      registry
    });
    return;
  }

  if (request.method === "GET" && pathname === "/runtime/security-boundaries") {
    writeJson(response, 200, {
      status: "ok",
      hybridAuthBoundary,
      accessPolicy: foundationAccessPolicy,
      tenantResolver: {
        tenantHeader: "x-commerce-tenant",
        workspaceHeader: "x-commerce-workspace",
        requiredForBusinessRoutes: true
      },
      audit: {
        enabled: true,
        sink: "structured-json-stdout"
      }
    });
    return;
  }

  if (request.method === "GET" && pathname === "/runtime/topology") {
    writeJson(response, 200, createRuntimeTopologyPayload());
    return;
  }

  if (pathname.startsWith("/v1/")) {
    const auth = verifyGatewayAuth(request, env, context);

    if (isOperationalRuntimeRoute(pathname)) {
      let body: Record<string, unknown> = {};
      if (request.method && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
        try {
          body = await readJsonBody(request);
        } catch (error) {
          writeAudit("gateway.request_body", "rejected", context);
          writeJson(response, 400, {
            status: "invalid_json_body",
            message: error instanceof Error ? error.message : "invalid_json_body",
            correlationId: context.correlationId,
            traceId: context.traceId
          });
          return;
        }
      }

      const route = await handleOperationalRoute({
        request,
        method: request.method,
        pathname,
        context,
        auth,
        env,
        db,
        registry,
        body
      });
      writeJson(response, route.statusCode, {
        ...(typeof route.payload === "object" && route.payload !== null ? route.payload : { payload: route.payload }),
        correlationId: context.correlationId,
        traceId: context.traceId
      });
      return;
    }

    const boundary = validateTenantWorkspaceScope(request, context, auth);

    if (!boundary.allowed) {
      writeAudit("gateway.business_boundary", "rejected", context);
      writeJson(response, 401, {
        status: "auth_boundary_required",
        message: "Business API route'ları tenant, workspace ve doğrulanmış JWT veya service-token bağlamı ister.",
        auth: {
          status: auth.status,
          mechanism: auth.mechanism,
          reasons: boundary.reasons
        },
        correlationId: context.correlationId,
        traceId: context.traceId
      });
      return;
    }

    writeAudit("gateway.business_boundary", "accepted", context);
    const healthMatrix = pathname === "/v1/control-center/health-matrix" ? await createHealthMatrix(registry) : undefined;
    const route = await handleBusinessRoute({
      method: request.method,
      pathname,
      context,
      auth,
      env,
      registry,
      ...(healthMatrix ? { healthMatrix } : {})
    });
    writeJson(response, route.statusCode, {
      ...(typeof route.payload === "object" && route.payload !== null ? route.payload : { payload: route.payload }),
      correlationId: context.correlationId,
      traceId: context.traceId
    });
    return;
  }

  writeJson(response, 404, {
    status: "not_found",
    message: "Gateway online. Business core route'ları /v1 altında mount edildi.",
    correlationId: context.correlationId,
    traceId: context.traceId
  });
});

server.listen(env.port, () => {
  log("info", "service_started", { service: serviceName }, { port: env.port });
});
