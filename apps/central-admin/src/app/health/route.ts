export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return Response.json({
    status: "ok",
    app: "central-admin",
    layer: "experience-shell",
    businessUiEnabled: false,
    rawOdooUiExposed: false
  });
}
