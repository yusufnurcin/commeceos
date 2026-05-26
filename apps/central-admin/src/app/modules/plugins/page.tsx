import { redirect } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/admin";
import { PluginRegistryPanel, type PlatformPluginView, type PluginModuleView } from "@/components/plugin-registry-panel";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

export default async function PluginsPage() {
  const session = await getCurrentSession();
  if (!session?.principal) {
    redirect("/login");
  }

  const response = await gatewayFetchWithRefresh("/v1/plugins", {}, { allowCookieMutation: false });
  if (response.status === 401) {
    redirect("/login");
  }

  const payload = (await readJson(response)) as {
    readonly plugins?: readonly PlatformPluginView[];
    readonly module?: PluginModuleView | null;
  };
  const item = findNavigationItemByHref("/modules") ?? navigationManifest[0]!;

  return (
    <AdminShell navigation={navigationManifest} principal={session.principal}>
      <PageHeader
        item={{
          ...item,
          label: "Plugin Registry",
          href: "/modules/plugins",
          description: "Core plugin manifestlerini, aktivasyon durumunu, ayarlarını ve event akışını gerçek Plugin Registry API üzerinden yönetin."
        }}
        principal={session.principal}
      />
      <PluginRegistryPanel initialPlugins={payload.plugins ?? []} module={payload.module ?? null} />
    </AdminShell>
  );
}
