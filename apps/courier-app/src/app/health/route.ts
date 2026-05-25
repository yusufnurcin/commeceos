export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return Response.json({
    status: "ok",
    app: "courier-app",
    layer: "experience-shell",
    businessUiEnabled: false,
    rawOdooUiExposed: false
  });
}
