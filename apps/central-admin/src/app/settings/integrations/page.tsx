import { redirect } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/admin";
import { IntegrationVaultPanel, type IntegrationProviderView } from "@/components/integration-vault-panel";
import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { gatewayFetchWithRefresh } from "@/lib/gateway-session";
import { getCurrentSession, readJson } from "@/lib/runtime-data";

export default async function IntegrationsPage() {
  const session = await getCurrentSession();
  if (!session?.principal) {
    redirect("/login");
  }

  const response = await gatewayFetchWithRefresh("/v1/integrations/providers", {}, { allowCookieMutation: false });
  if (response.status === 401) {
    redirect("/login");
  }
  const payload = (await readJson(response)) as { readonly providers?: readonly IntegrationProviderView[] };
  const item = findNavigationItemByHref("/integrations") ?? findNavigationItemByHref("/platform/settings") ?? navigationManifest[0]!;

  return (
    <AdminShell navigation={navigationManifest} principal={session.principal}>
      <PageHeader
        item={{
          ...item,
          id: "settings-integrations",
          label: "Integration Vault",
          href: "/settings/integrations",
          description: "Dış servis credential kayıtlarını şifreli saklayın; bağlantı hazırlığını ve sağlayıcı dayanıklılık politikalarını tek merkezden yönetin.",
          permissionKey: "integrations.providers.manage",
          status: "runtime-ready"
        }}
        principal={session.principal}
      />
      <IntegrationVaultPanel initialProviders={payload.providers ?? []} />
    </AdminShell>
  );
}
