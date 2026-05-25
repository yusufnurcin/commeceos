export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return Response.json({
    status: "ok",
    app: "storefront",
    layer: "experience-shell",
    businessUiEnabled: false,
    rawOdooUiExposed: false
  });
}
