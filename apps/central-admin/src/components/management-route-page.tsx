import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdminShell,
  DataToolbar,
  EmptyOperationalState,
  OperationGrid,
  PageHeader,
  ServiceStatusCard,
  StarterFormCard
} from "@/components/admin";
import { BlueprintCenterPanel } from "@/components/blueprint-center-panel";
import { navigationManifest, type NavigationItem } from "@/config/navigation";
import { getManagementAreaByHref, type ManagementArea } from "@/config/management";
import { getDashboardRuntime } from "@/lib/runtime-data";

function fallbackArea(item: NavigationItem): ManagementArea {
  return {
    id: item.id,
    title: item.label,
    description: item.description,
    href: item.href,
    statusLabel: item.status === "runtime-ready" ? "Hazır" : "Hazırlanıyor",
    statusTone: item.status === "runtime-ready" ? "ready" : item.status === "planned" ? "planned" : "setup",
    primaryAction: {
      label: item.primaryAction,
      href: item.href,
      description: item.description
    },
    secondaryActions: item.secondaryActions.map((action) => ({
      label: action,
      href: item.href,
      description: "Bu işlem ilgili modül etkinleşince kullanılabilir."
    })),
    emptyState: item.emptyState.description,
    nextStep: "Bu alanın gerçek iş akışı ilgili modül ve backend bağlantısı tamamlandığında açılacak.",
    engineService: item.connectedEngine === "gateway" ? "gateway-api" : item.connectedEngine,
    engineLabel: item.connectedEngine ? `${item.connectedEngine} servisi` : "Modül bağlantısı",
    operations: item.children.length
      ? item.children.map((child) => ({
          label: child.label,
          href: child.href,
          description: child.description
        }))
      : [
          {
            label: item.label,
            href: item.href,
            description: item.description
          }
        ]
  };
}

function serviceDetail(area: ManagementArea, entries: readonly { readonly service?: string; readonly status?: string; readonly latencyMs?: number }[]) {
  if (!area.engineService) {
    return {
      label: area.engineLabel ?? "Bağlı servis",
      status: area.statusLabel,
      detail: "Bu bölüm modül ayarlarıyla açılacak.",
      tone: area.statusTone
    } as const;
  }

  const entry = entries.find((candidate) => candidate.service === area.engineService);
  return {
    label: area.engineLabel ?? area.engineService,
    status: entry?.status === "ok" ? "Hazır" : "Bekleniyor",
    detail: entry ? `${entry.service} servisi yanıt veriyor${typeof entry.latencyMs === "number" ? ` · ${entry.latencyMs} ms` : ""}` : "Servis sinyali bekleniyor.",
    tone: entry?.status === "ok" ? "ready" : area.statusTone
  } as const;
}

export async function ManagementRoutePage({ item }: { readonly item: NavigationItem }) {
  const payload = await getDashboardRuntime();
  if (payload.status === "auth_required" || !payload.me?.principal) {
    redirect("/login");
  }

  const principal = payload.me.principal;
  if (item.href === "/blueprints") {
    return (
      <AdminShell navigation={navigationManifest} principal={principal}>
        <PageHeader item={item} principal={principal} />
        <BlueprintCenterPanel />
      </AdminShell>
    );
  }

  const area = getManagementAreaByHref(item.href) ?? fallbackArea(item);
  const healthEntries = payload.healthMatrix?.entries ?? [];
  const engineStatus = serviceDetail(area, healthEntries);
  const headerItem = {
    ...item,
    label: area.title,
    description: area.description
  };

  return (
    <AdminShell navigation={navigationManifest} principal={principal}>
      <PageHeader
        item={headerItem}
        principal={principal}
        actions={
          <Link className="primary-link" href={area.primaryAction.href}>
            {area.primaryAction.label}
          </Link>
        }
      />

      <section className="management-intro-grid">
        <section className="dashboard-section">
          <DataToolbar title="Bu bölümde ne yapılır?" description="Günlük yönetim işi için ana adımlar." />
          <div className="what-to-do-list">
            {area.operations.slice(0, 6).map((operation) => (
              <article key={`${operation.href}-${operation.label}`}>
                <strong>{operation.label}</strong>
                <span>{operation.description}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="dashboard-section">
          <DataToolbar title="Bağlı servis durumu" description="Teknik cevap yerine okunabilir servis özeti." />
          <ServiceStatusCard {...engineStatus} />
          <EmptyOperationalState title={area.emptyState} description={area.nextStep} />
        </section>
      </section>

      <section className="dashboard-section">
        <DataToolbar title="İlgili işlemler" description="Alt menüler sidebar'a yığılmaz; bu sayfada iş kartı olarak görünür." />
        <OperationGrid operations={area.operations} />
      </section>

      {area.starterForm ? <StarterFormCard form={area.starterForm} /> : null}

      <section className="next-step-panel">
        <strong>Sonraki adım</strong>
        <p>{area.nextStep}</p>
        <div>
          {area.secondaryActions.slice(0, 3).map((action) => (
            <Link href={action.href} key={`${action.href}-${action.label}`}>
              {action.label}
            </Link>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
