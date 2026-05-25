import type { NavigationItem } from "@/config/navigation";
import { ManagementRoutePage } from "@/components/management-route-page";

export async function GenericModulePage({ item }: { readonly item: NavigationItem }) {
  return <ManagementRoutePage item={item} />;
}
