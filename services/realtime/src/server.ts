import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { defaultEventContracts, defaultRealtimeSubscriptions, runtimeEventChannels } from "@commerce-os/sync-core";

const serviceName = "realtime";
const port = Number(process.env.PORT ?? 8091);
const gatewayServiceToken = process.env.GATEWAY_SERVICE_TOKEN ?? "commerce_os_gateway_service_dev_token";
const authJwtSecret = process.env.AUTH_JWT_SECRET ?? "commerce_os_gateway_jwt_dev_secret_change_before_prod";
const authJwtIssuer = process.env.AUTH_JWT_ISSUER ?? "commerce-os-gateway";
const authJwtAudience = process.env.AUTH_JWT_AUDIENCE ?? "commerce-os-workspaces";

interface PresenceConnection {
  readonly connectionId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly principalId: string;
  readonly authMechanism: "service-token" | "jwt";
  readonly connectedAt: string;
  subscriptions: Set<string>;
}

interface JwtClaims {
  readonly iss?: string;
  readonly aud?: string | readonly string[];
  readonly sub?: string;
  readonly exp?: number;
  readonly token_type?: "access" | "refresh";
  readonly tenant_id?: string;
  readonly workspace_id?: string;
}

const presence = new Map<WebSocket, PresenceConnection>();

function log(message: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), service: serviceName, message, ...details }));
}

function writeJson(response: import("node:http").ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function constantTimeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function headerValue(request: IncomingMessage, name: string) {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function decodeJsonPart<T>(value: string): T | undefined {
  try {
    const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
    return JSON.parse(Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as T;
  } catch {
    return undefined;
  }
}

function verifyJwt(token: string, tenantId: string, workspaceId: string) {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return undefined;
  }

  const claims = decodeJsonPart<JwtClaims>(encodedPayload);
  const expectedSignature = createHmac("sha256", authJwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  const audiences = Array.isArray(claims?.aud) ? claims.aud : claims?.aud ? [claims.aud] : [];
  const now = Math.floor(Date.now() / 1000);

  if (
    !claims?.sub ||
    claims.iss !== authJwtIssuer ||
    !audiences.includes(authJwtAudience) ||
    claims.token_type !== "access" ||
    !claims.exp ||
    claims.exp <= now ||
    claims.tenant_id !== tenantId ||
    claims.workspace_id !== workspaceId ||
    !constantTimeEquals(encodedSignature, expectedSignature)
  ) {
    return undefined;
  }

  return claims.sub;
}

function authenticateUpgrade(request: IncomingMessage) {
  const url = new URL(request.url ?? "/", "http://realtime");
  const tenantId = headerValue(request, "x-commerce-tenant") ?? url.searchParams.get("tenant");
  const workspaceId = headerValue(request, "x-commerce-workspace") ?? url.searchParams.get("workspace");
  if (!tenantId || !workspaceId) {
    return { ok: false, statusCode: 400, reason: "tenant_workspace_required" } as const;
  }

  const serviceToken = headerValue(request, "x-commerce-service-token");
  if (serviceToken) {
    const configuredHash = gatewayServiceToken.startsWith("sha256:")
      ? gatewayServiceToken.slice("sha256:".length)
      : sha256(gatewayServiceToken);
    if (constantTimeEquals(sha256(serviceToken), configuredHash)) {
      return {
        ok: true,
        tenantId,
        workspaceId,
        principalId: "gateway-service-token",
        authMechanism: "service-token" as const
      };
    }
  }

  const authorization = headerValue(request, "authorization");
  const token = authorization?.toLowerCase().startsWith("bearer ") ? authorization.slice("bearer ".length).trim() : undefined;
  if (token) {
    const principalId = verifyJwt(token, tenantId, workspaceId);
    if (principalId) {
      return { ok: true, tenantId, workspaceId, principalId, authMechanism: "jwt" as const };
    }
  }

  return { ok: false, statusCode: 401, reason: "websocket_auth_required" } as const;
}

function allowedChannel(connection: PresenceConnection, channel: string) {
  return (
    channel === `tenant:${connection.tenantId}` ||
    channel === `tenant:${connection.tenantId}:workspace:${connection.workspaceId}` ||
    defaultRealtimeSubscriptions.some(
      (subscription) =>
        channel === `tenant:${connection.tenantId}:${subscription.channel}` ||
        channel === `tenant:${connection.tenantId}:workspace:${connection.workspaceId}:${subscription.channel}`
    )
  );
}

const server = createServer((request, response) => {
  const correlationId = headerValue(request, "x-correlation-id") ?? randomUUID();
  response.setHeader("x-correlation-id", String(correlationId));
  log("request_received", { method: request.method, url: request.url, correlationId });

  if (request.method === "GET" && (request.url === "/health" || request.url === "/ready")) {
    writeJson(response, 200, {
      status: request.url === "/ready" ? "ready" : "ok",
      service: serviceName,
      layer: "realtime-event-fabric",
      websocketAuthMounted: true,
      tenantIsolatedChannels: true,
      workspaceIsolatedChannels: true,
      redisUrlConfigured: Boolean(process.env.REDIS_URL),
      activeConnections: presence.size
    });
    return;
  }

  if (request.method === "GET" && request.url === "/runtime/channels") {
    writeJson(response, 200, {
      status: "ok",
      eventContracts: defaultEventContracts.map((contract) => ({
        eventName: contract.eventName,
        version: contract.version.currentVersion,
        domain: contract.domain
      })),
      channels: runtimeEventChannels.map((channel) => ({
        channel,
        tenantScoped: true,
        workspaceScoped: channel !== "sync" && channel !== "erp-bridge",
        redisStream: `stream:${channel}`,
        replaySupported: true
      })),
      subscriptions: defaultRealtimeSubscriptions
    });
    return;
  }

  if (request.method === "GET" && request.url === "/runtime/presence") {
    writeJson(response, 200, {
      status: "ok",
      connections: [...presence.values()].map((connection) => ({
        connectionId: connection.connectionId,
        tenantId: connection.tenantId,
        workspaceId: connection.workspaceId,
        principalId: connection.principalId,
        authMechanism: connection.authMechanism,
        connectedAt: connection.connectedAt,
        subscriptions: [...connection.subscriptions]
      }))
    });
    return;
  }

  if (request.method === "GET" && request.url === "/runtime/subscriptions") {
    writeJson(response, 200, {
      status: "ok",
      subscriptions: defaultRealtimeSubscriptions,
      authRequired: true,
      gatewayControlled: true,
      retryAware: true,
      eventVersionAware: true
    });
    return;
  }

  writeJson(response, 404, { status: "not_found", service: serviceName });
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", "http://realtime");
  if (url.pathname !== "/ws") {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }

  const auth = authenticateUpgrade(request);
  if (!auth.ok) {
    socket.write(`HTTP/1.1 ${auth.statusCode} Unauthorized\r\n\r\n`);
    socket.destroy();
    log("websocket_rejected", { reason: auth.reason });
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    const connection: PresenceConnection = {
      connectionId: randomUUID(),
      tenantId: auth.tenantId,
      workspaceId: auth.workspaceId,
      principalId: auth.principalId,
      authMechanism: auth.authMechanism,
      connectedAt: new Date().toISOString(),
      subscriptions: new Set([
        `tenant:${auth.tenantId}`,
        `tenant:${auth.tenantId}:workspace:${auth.workspaceId}`
      ])
    };
    presence.set(ws, connection);
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", (ws) => {
  const connection = presence.get(ws);
  if (!connection) {
    ws.close(1011, "presence_missing");
    return;
  }

  ws.send(
    JSON.stringify({
      type: "presence.connected",
      connectionId: connection.connectionId,
      tenantId: connection.tenantId,
      workspaceId: connection.workspaceId,
      subscriptions: [...connection.subscriptions],
      eventContracts: defaultEventContracts.map((contract) => ({
        eventName: contract.eventName,
        version: contract.version.currentVersion
      }))
    })
  );

  ws.on("message", (rawMessage) => {
    const state = presence.get(ws);
    if (!state) {
      return;
    }

    let message: { readonly type?: string; readonly channel?: string };
    try {
      message = JSON.parse(rawMessage.toString()) as { readonly type?: string; readonly channel?: string };
    } catch {
      ws.send(JSON.stringify({ type: "error", reason: "invalid_json" }));
      return;
    }

    if (message.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", connectionId: state.connectionId, at: new Date().toISOString() }));
      return;
    }

    if (message.type === "subscribe" && message.channel) {
      if (!allowedChannel(state, message.channel)) {
        ws.send(JSON.stringify({ type: "subscription.rejected", channel: message.channel, reason: "channel_scope_denied" }));
        return;
      }

      state.subscriptions.add(message.channel);
      ws.send(JSON.stringify({ type: "subscription.accepted", channel: message.channel }));
      return;
    }

    if (message.type === "replay.requested") {
      ws.send(
        JSON.stringify({
          type: "replay.adapter_required",
          message: "Event replay gateway store üzerinden yapılır; realtime servis fake replay üretmez."
        })
      );
      return;
    }

    ws.send(JSON.stringify({ type: "error", reason: "unsupported_message_type" }));
  });

  ws.on("close", () => {
    presence.delete(ws);
  });
});

server.listen(port, () => {
  log("service_started", { port });
});
