import { notFound } from "next/navigation";
import { findNavigationItemByHref } from "@/config/navigation";
import { GenericModulePage } from "@/components/generic-module-page";

export default async function WorkspaceModuleRootPage({ params }: { readonly params: Promise<{ readonly workspace: string }> }) {
  const { workspace } = await params;
  const href = `/${workspace}`;
  const item = findNavigationItemByHref(href);

  if (!item) {
    notFound();
  }

  return <GenericModulePage item={item} />;
}
