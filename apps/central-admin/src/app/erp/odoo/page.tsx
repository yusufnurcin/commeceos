import { redirect } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/admin";
import { OdooEngineCenter, type OdooEngineStatusView } from "@/components/odoo-engine-center";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

export default async function OdooCenterPage() {
  const session = await getCurrentSession();
  if (!session?.principal) redirect("/login");
  const response = await gatewayFetchWithRefresh("/v1/engines/odoo", {}, { allowCookieMutation: false });
  if (response.status === 401) redirect("/login");
  const payload = await readJson(response) as unknown as OdooEngineStatusView;
  const item = findNavigationItemByHref("/erp/odoo") ?? navigationManifest[0]!;
  return (
    <AdminShell navigation={navigationManifest} principal={session.principal}>
      <PageHeader item={{ ...item, label: "ERP Provider / Odoo Engine", description: "Opsiyonel Odoo provider sağlık seviyesini, hazır sınırlarını ve henüz bağlanmamış ERP Center parçalarını dürüstçe izleyin.", status: "runtime-ready" }} principal={session.principal} />
      <OdooEngineCenter payload={payload} />
    </AdminShell>
  );
}
