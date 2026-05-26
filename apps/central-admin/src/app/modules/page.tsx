import { redirect } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/admin";
import { ModuleRegistryPanel, type PlatformModuleView } from "@/components/module-registry-panel";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession } from "@/lib/runtime-data";

export default async function ModulesPage() {
  const session = await getCurrentSession();
  if (!session?.principal) {
    redirect("/login");
  }

  const item = findNavigationItemByHref("/modules") ?? navigationManifest[0]!;
  const response = await gatewayFetchWithRefresh("/v1/modules", {}, { allowCookieMutation: false });
  if (response.status === 401) {
    redirect("/login");
  }

  const payload = (await response.json().catch(() => ({ modules: [] }))) as {
    readonly modules?: readonly PlatformModuleView[];
    readonly status?: string;
  };

  return (
    <AdminShell navigation={navigationManifest} principal={session.principal}>
      <PageHeader
        item={{
          ...item,
          label: "Modül Registry",
          description: "Platform modüllerini PostgreSQL-backed registry üzerinden yönetin; enable, disable, settings ve event akışları Gateway API ile çalışır."
        }}
        principal={session.principal}
      />
      <ModuleRegistryPanel initialModules={payload.modules ?? []} />
    </AdminShell>
  );
}
