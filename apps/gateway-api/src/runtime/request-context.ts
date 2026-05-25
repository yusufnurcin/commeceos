import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { AUTHORIZATION_HEADER, SERVICE_TOKEN_HEADER } from "@commerce-os/auth-core";
import { TENANT_HEADER, WORKSPACE_HEADER } from "@commerce-os/tenant-core";

export interface RequestContext {
  readonly correlationId: string;
  readonly traceId: string;
  readonly tenantId: string | undefined;
  readonly workspaceId: string | undefined;
  readonly authMechanism: "jwt" | "session" | "service-token" | undefined;
}

function headerValue(request: IncomingMessage, name: string) {
  const value = request.headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function resolveAuthMechanism(request: IncomingMessage): RequestContext["authMechanism"] {
  const authorization = headerValue(request, AUTHORIZATION_HEADER);
  const serviceToken = headerValue(request, SERVICE_TOKEN_HEADER);
  const cookie = headerValue(request, "cookie");

  if (serviceToken) {
    return "service-token";
  }

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return "jwt";
  }

  if (cookie?.includes("commerce_os_session=")) {
    return "session";
  }

  return undefined;
}

export function createRequestContext(request: IncomingMessage): RequestContext {
  const correlationId = headerValue(request, "x-correlation-id") ?? randomUUID();
  const traceId = headerValue(request, "traceparent") ?? randomUUID();
  const tenantId = headerValue(request, TENANT_HEADER);
  const workspaceId = headerValue(request, WORKSPACE_HEADER);

  return {
    correlationId,
    traceId,
    tenantId,
    workspaceId,
    authMechanism: resolveAuthMechanism(request)
  };
}
