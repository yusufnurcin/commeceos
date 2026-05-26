import { redirect } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/admin";
import {
  ThemeRegistryPanel,
  type PlatformThemeView,
  type TenantOptionView,
  type ThemeModuleView
} from "@/components/theme-registry-panel";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

export default async function ThemesPage() {
  const session = await getCurrentSession();
  if (!session?.principal) {
    redirect("/login");
  }

  const [themesResponse, tenantsResponse] = await Promise.all([
    gatewayFetchWithRefresh("/v1/themes", {}, { allowCookieMutation: false }),
    gatewayFetchWithRefresh("/v1/tenants", {}, { allowCookieMutation: false })
  ]);

  if (themesResponse.status === 401 || tenantsResponse.status === 401) {
    redirect("/login");
  }

  const themesPayload = (await readJson(themesResponse)) as {
    readonly themes?: readonly PlatformThemeView[];
    readonly module?: ThemeModuleView | null;
  };
  const tenantsPayload = (await readJson(tenantsResponse)) as {
    readonly tenants?: readonly TenantOptionView[];
  };
  const item = findNavigationItemByHref("/design/themes") ?? navigationManifest[0]!;

  return (
    <AdminShell navigation={navigationManifest} principal={session.principal}>
      <PageHeader
        item={{
          ...item,
          label: "Tema Registry",
          description: "90 sektör tema manifestini ve tenant tema atamalarını gerçek Theme Registry API üzerinden yönetin."
        }}
        principal={session.principal}
      />
      <ThemeRegistryPanel
        initialThemes={themesPayload.themes ?? []}
        tenants={tenantsPayload.tenants ?? []}
        module={themesPayload.module ?? null}
      />
    </AdminShell>
  );
}
