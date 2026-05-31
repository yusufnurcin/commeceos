import { redirect } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/admin";
import { DemoCenterPanel, type DemoStatusView } from "@/components/demo-center-panel";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

export default async function DemoCenterPage() {
  const session = await getCurrentSession();
  if (!session?.principal) redirect("/login");
  const response = await gatewayFetchWithRefresh("/v1/demo/status", {}, { allowCookieMutation: false });
  if (response.status === 401) redirect("/login");
  const payload = await readJson(response) as unknown as DemoStatusView;
  const item = findNavigationItemByHref("/platform/settings") ?? navigationManifest[0]!;
  return (
    <AdminShell navigation={navigationManifest} principal={session.principal}>
      <PageHeader item={{ ...item, id: "settings-demo", label: "Demo Merkezi", href: "/settings/demo", description: "Gerçek lifecycle sözleşmelerini kullanan, açıkça etiketlenmiş demo kayıtlarını oluşturun veya güvenle temizleyin.", permissionKey: "platform.demo.manage", status: "runtime-ready" }} principal={session.principal} />
      <DemoCenterPanel initialStatus={payload} />
    </AdminShell>
  );
}
