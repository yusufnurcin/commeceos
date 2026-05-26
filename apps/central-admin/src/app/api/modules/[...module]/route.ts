import { NextResponse } from "next/server";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";

function modulePath(parts: readonly string[]) {
  return `/v1/modules/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
}

async function forward(request: Request, context: { readonly params: Promise<{ readonly module: readonly string[] }> }, method: string) {
  const { module } = await context.params;
  if (!module.length) {
    return NextResponse.json({ status: "module_route_not_found" }, { status: 404 });
  }

  const body =
    method === "GET"
      ? undefined
      : JSON.stringify((await request.json().catch(() => ({}))) as Record<string, unknown>);

  const response = await gatewayFetchWithRefresh(modulePath(module), {
    method,
    ...(body ? { body } : {})
  });
  const payload = await response.json().catch(() => ({ status: "gateway_unavailable" }));
  return NextResponse.json(payload, { status: response.status });
}

export async function GET(request: Request, context: { readonly params: Promise<{ readonly module: readonly string[] }> }) {
  return forward(request, context, "GET");
}

export async function POST(request: Request, context: { readonly params: Promise<{ readonly module: readonly string[] }> }) {
  return forward(request, context, "POST");
}

export async function PATCH(request: Request, context: { readonly params: Promise<{ readonly module: readonly string[] }> }) {
  return forward(request, context, "PATCH");
}
