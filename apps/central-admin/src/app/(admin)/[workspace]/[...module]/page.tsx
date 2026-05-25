import { notFound } from "next/navigation";
import { findNavigationItemByHref } from "@/config/navigation";
import { GenericModulePage } from "@/components/generic-module-page";

export default async function WorkspaceModulePage({
  params
}: {
  readonly params: Promise<{ readonly workspace: string; readonly module: readonly string[] }>;
}) {
  const { workspace, module } = await params;
  const href = `/${workspace}/${module.join("/")}`;
  const item = findNavigationItemByHref(href);

  if (!item) {
    notFound();
  }

  return <GenericModulePage item={item} />;
}
