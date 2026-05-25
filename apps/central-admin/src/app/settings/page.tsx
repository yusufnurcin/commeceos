import { findNavigationItemByHref, navigationManifest } from "@/config/navigation";
import { ManagementRoutePage } from "@/components/management-route-page";

export default async function SettingsPage() {
  const baseItem = findNavigationItemByHref("/platform/settings") ?? navigationManifest[0]!;

  return (
    <ManagementRoutePage
      item={{
        ...baseItem,
        id: "settings",
        label: "Sistem Ayarları",
        description: "Platform adı, logo, dil, para birimi, ülkeler, vergi, iletişim, API/Webhook ve feature flag ayarları.",
        href: "/settings",
        workspace: "Sistem Ayarları",
        permissionKey: "platform.settings.manage"
      }}
    />
  );
}
