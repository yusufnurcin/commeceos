import { NextResponse } from "next/server";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";

function integrationPath(parts: readonly string[]) {
  return `/v1/integrations/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
}

async function forward(
  request: Request,
  context: { readonly params: Promise<{ readonly integration: readonly string[] }> },
  method: string
) {
  const { integration } = await context.params;
  if (!integration.length) {
    return NextResponse.json({ status: "integration_route_not_found" }, { status: 404 });
  }

  const body =
    method === "GET" || method === "DELETE"
      ? undefined
      : JSON.stringify((await request.json().catch(() => ({}))) as Record<string, unknown>);
  const response = await gatewayFetchWithRefresh(integrationPath(integration), {
    method,
    ...(body ? { body } : {})
  });
  const payload = await response.json().catch(() => ({ status: "gateway_unavailable" }));
  return NextResponse.json(payload, { status: response.status });
}

export async function GET(request: Request, context: { readonly params: Promise<{ readonly integration: readonly string[] }> }) {
  return forward(request, context, "GET");
}

export async function POST(request: Request, context: { readonly params: Promise<{ readonly integration: readonly string[] }> }) {
  return forward(request, context, "POST");
}

export async function PATCH(request: Request, context: { readonly params: Promise<{ readonly integration: readonly string[] }> }) {
  return forward(request, context, "PATCH");
}

export async function DELETE(request: Request, context: { readonly params: Promise<{ readonly integration: readonly string[] }> }) {
  return forward(request, context, "DELETE");
}
