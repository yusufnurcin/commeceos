import { NextResponse } from "next/server";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";

function catalogPath(parts: readonly string[]) {
  return `/v1/catalog/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
}

async function forward(
  request: Request,
  context: { readonly params: Promise<{ readonly catalog: readonly string[] }> },
  method: string
) {
  const { catalog } = await context.params;
  if (!catalog.length) {
    return NextResponse.json({ status: "catalog_route_not_found" }, { status: 404 });
  }
  const body = method === "GET" ? undefined : JSON.stringify((await request.json().catch(() => ({}))) as Record<string, unknown>);
  const response = await gatewayFetchWithRefresh(catalogPath(catalog), {
    method,
    ...(body ? { body } : {})
  });
  const payload = await response.json().catch(() => ({ status: "gateway_unavailable" }));
  return NextResponse.json(payload, { status: response.status });
}

export async function GET(request: Request, context: { readonly params: Promise<{ readonly catalog: readonly string[] }> }) {
  return forward(request, context, "GET");
}

export async function POST(request: Request, context: { readonly params: Promise<{ readonly catalog: readonly string[] }> }) {
  return forward(request, context, "POST");
}

export async function PATCH(request: Request, context: { readonly params: Promise<{ readonly catalog: readonly string[] }> }) {
  return forward(request, context, "PATCH");
}
