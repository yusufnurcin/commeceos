"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { NavigationItem, NavigationStatus } from "@/config/navigation";
import {
  primarySidebarItems,
  searchableManagementLinks,
  type ManagementArea,
  type ManagementLink,
  type ManagementTone,
  type StarterForm
} from "@/config/management";

export interface PrincipalView {
  readonly email?: string | null;
  readonly name?: string | null;
  readonly roles?: readonly string[];
  readonly permissions?: readonly string[];
  readonly workspaceId?: string;
  readonly tenantId?: string;
}

function statusLabel(status: NavigationStatus) {
  const labels: Record<NavigationStatus, string> = {
    active: "Aktif",
    "runtime-ready": "Hazır",
    empty: "Veri bekliyor",
    planned: "Planlandı",
    "requires-tenant": "Tenant gerekli",
    "requires-odoo": "Odoo gerekli",
    "requires-medusa": "Medusa gerekli",
    "requires-integration": "Entegrasyon gerekli",
    "requires-license": "Lisans gerekli",
    "requires-module": "Modül gerekli",
    disabled: "Kapalı"
  };
  return labels[status];
}

function toneLabel(tone: ManagementTone) {
  const labels: Record<ManagementTone, string> = {
    ready: "Hazır",
    waiting: "Veri bekliyor",
    setup: "Kurulum gerekli",
    planned: "Planlandı",
    attention: "Dikkat gerekiyor"
  };
  return labels[tone];
}

export function hasPermission(principal: PrincipalView | undefined, item: Pick<NavigationItem, "permissionKey" | "requiredRoles">) {
  const roles = principal?.roles ?? [];
  const permissions = principal?.permissions ?? [];
  return roles.includes("super_admin") || permissions.includes("*") || permissions.includes(item.permissionKey);
}

export function ModuleStatusBadge({ status }: { readonly status: NavigationStatus }) {
  return (
    <span className="status-badge" data-status={status}>
      {statusLabel(status)}
    </span>
  );
}

export function PermissionBadge({ permissionKey, allowed }: { readonly permissionKey: string; readonly allowed?: boolean }) {
  return (
    <span className="permission-badge" data-allowed={allowed ? "true" : "false"} title={`Yetki anahtarı: ${permissionKey}`}>
      {allowed ? "Erişim var" : "Yetki bekliyor"}
    </span>
  );
}

export function Breadcrumbs({ item }: { readonly item: NavigationItem }) {
  return (
    <nav className="admin-breadcrumb" aria-label="Sayfa yolu">
      <Link href="/">Komuta Merkezi</Link>
      <span>{item.workspace}</span>
      {item.href !== "/" && <strong>{item.label}</strong>}
    </nav>
  );
}

export function EmptyOperationalState({
  title,
  description,
  actionLabel,
  href
}: {
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string | undefined;
  readonly href?: string | undefined;
}) {
  return (
    <section className="operational-empty">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {actionLabel && href ? <Link href={href}>{actionLabel}</Link> : null}
    </section>
  );
}

export function PageHeader({
  item,
  principal,
  actions
}: {
  readonly item: NavigationItem;
  readonly principal?: PrincipalView | undefined;
  readonly actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <Breadcrumbs item={item} />
        <h1>{item.label}</h1>
        <p>{item.description}</p>
        <div className="header-badges">
          <ModuleStatusBadge status={item.status} />
          <PermissionBadge permissionKey={item.permissionKey} allowed={hasPermission(principal, item)} />
        </div>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function HealthMiniCard({
  service,
  layer,
  status,
  latencyMs
}: {
  readonly service: string;
  readonly layer?: string | undefined;
  readonly status?: string | undefined;
  readonly latencyMs?: number | undefined;
}) {
  return (
    <article className="health-mini-card">
      <div>
        <strong>{service}</strong>
        <span>{layer ?? "Servis alanı"}</span>
      </div>
      <mark data-state={status ?? "unknown"}>{status === "ok" ? "Hazır" : status ?? "Bekleniyor"}</mark>
      <small>{typeof latencyMs === "number" ? `${latencyMs} ms` : "Sinyal bekleniyor"}</small>
    </article>
  );
}

export function AuditMiniTimeline({
  events
}: {
  readonly events?: readonly {
    readonly audit_id?: string;
    readonly action?: string;
    readonly result?: string;
    readonly occurred_at?: string;
    readonly tenant_id?: string;
    readonly workspace_id?: string;
  }[] | undefined;
}) {
  if (!events?.length) {
    return (
      <EmptyOperationalState
        title="Audit olayı bekleniyor"
        description="Login, failed login, tenant_created veya session_revoked gibi gerçek olaylar oluştuğunda burada listelenir."
      />
    );
  }

  return (
    <ol className="audit-mini-timeline">
      {events.slice(0, 8).map((event) => (
        <li key={event.audit_id ?? `${event.action}-${event.occurred_at}`}>
          <strong>{event.action ?? "audit.event"}</strong>
          <span>{event.result ?? "result yok"}</span>
          <small>
            {event.tenant_id ?? "tenant yok"} · {event.workspace_id ?? "workspace yok"} · {event.occurred_at ?? "zaman yok"}
          </small>
        </li>
      ))}
    </ol>
  );
}

export function ActionCard({
  label,
  description,
  href,
  disabled
}: {
  readonly label: string;
  readonly description: string;
  readonly href: string;
  readonly disabled?: boolean;
}) {
  const content = (
    <>
      <strong>{label}</strong>
      <span>{description}</span>
    </>
  );

  return disabled ? (
    <div className="action-card" aria-disabled="true">
      {content}
    </div>
  ) : (
    <Link className="action-card" href={href}>
      {content}
    </Link>
  );
}

export function ModuleCard({ item, principal }: { readonly item: NavigationItem; readonly principal?: PrincipalView | undefined }) {
  return (
    <Link className="module-card" href={item.href}>
      <div className="module-card-main">
        <span>{item.icon}</span>
        <div>
          <strong>{item.label}</strong>
          <p>{item.description}</p>
        </div>
      </div>
      <div className="module-card-meta">
        <ModuleStatusBadge status={item.status} />
        <small>{hasPermission(principal, item) ? "Açılabilir" : "Yetki bekliyor"}</small>
      </div>
    </Link>
  );
}

export function WorkspaceCard({ item, principal }: { readonly item: NavigationItem; readonly principal?: PrincipalView | undefined }) {
  return (
    <article className="workspace-card">
      <div>
        <span className="workspace-icon">{item.icon}</span>
        <h3>{item.label}</h3>
        <p>{item.description}</p>
      </div>
      <div className="workspace-card-footer">
        <ModuleStatusBadge status={item.status} />
        <Link href={item.href}>{hasPermission(principal, item) ? "Aç" : "Yetkiyi incele"}</Link>
      </div>
    </article>
  );
}

export function QuickActionGrid({ actions }: { readonly actions: readonly ManagementLink[] }) {
  return (
    <section className="quick-action-grid" aria-label="Hızlı işlemler">
      {actions.map((action) => (
        <ActionCard key={action.href} {...action} />
      ))}
    </section>
  );
}

export function DataToolbar({
  title,
  description,
  action
}: {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className="data-toolbar">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ManagementStatusPill({ tone, label }: { readonly tone: ManagementTone; readonly label?: string }) {
  return (
    <span className="management-status-pill" data-tone={tone}>
      {label ?? toneLabel(tone)}
    </span>
  );
}

export function ManagementAreaCard({ area }: { readonly area: ManagementArea }) {
  return (
    <article className="management-area-card">
      <header>
        <div>
          <h3>{area.title}</h3>
          <p>{area.description}</p>
        </div>
        <ManagementStatusPill tone={area.statusTone} label={area.statusLabel} />
      </header>
      <div className="management-card-actions">
        <Link className="primary-link" href={area.primaryAction.href}>
          {area.primaryAction.label}
        </Link>
        {area.secondaryActions.slice(0, 3).map((action) => (
          <Link className="secondary-link" href={action.href} key={`${area.id}-${action.href}`}>
            {action.label}
          </Link>
        ))}
      </div>
    </article>
  );
}

export function ManagementAreaGrid({ areas }: { readonly areas: readonly ManagementArea[] }) {
  return (
    <section className="management-area-grid">
      {areas.map((area) => (
        <ManagementAreaCard area={area} key={area.id} />
      ))}
    </section>
  );
}

export function OperationGrid({ operations }: { readonly operations: readonly ManagementLink[] }) {
  return (
    <section className="operation-grid">
      {operations.map((operation) => (
        <Link className="operation-card" href={operation.href} key={`${operation.href}-${operation.label}`}>
          <strong>{operation.label}</strong>
          <span>{operation.description}</span>
        </Link>
      ))}
    </section>
  );
}

export function StarterFormCard({ form }: { readonly form: StarterForm }) {
  return (
    <section className="starter-form-card">
      <div>
        <h2>{form.title}</h2>
        <p>{form.description}</p>
      </div>
      <form>
        {form.fields.map((field) => (
          <label key={field.label}>
            {field.label}
            <input readOnly type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"} placeholder={field.placeholder} />
            {field.helper ? <small>{field.helper}</small> : null}
          </label>
        ))}
        <button disabled type="button">
          {form.actionLabel}
        </button>
      </form>
      <p>{form.note}</p>
    </section>
  );
}

export function ServiceStatusCard({
  label,
  status,
  detail,
  tone = "waiting"
}: {
  readonly label: string;
  readonly status: string;
  readonly detail: string;
  readonly tone?: ManagementTone;
}) {
  return (
    <article className="service-status-card">
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <ManagementStatusPill tone={tone} label={status} />
    </article>
  );
}

export function ModuleGrid({ items, principal }: { readonly items: readonly NavigationItem[]; readonly principal?: PrincipalView | undefined }) {
  if (!items.length) {
    return <EmptyOperationalState title="Modül tanımı bekleniyor" description="Bu workspace için manifest içinde alt modül tanımı yok." />;
  }
  return (
    <section className="module-grid">
      {items.map((item) => (
        <ModuleCard item={item} key={item.id} principal={principal} />
      ))}
    </section>
  );
}

export function WorkspaceOverview({ items, principal }: { readonly items: readonly NavigationItem[]; readonly principal?: PrincipalView | undefined }) {
  return (
    <section className="workspace-overview">
      {items.map((item) => (
        <WorkspaceCard item={item} key={item.id} principal={principal} />
      ))}
    </section>
  );
}

export function NavigationSearch({ items }: { readonly items: readonly ManagementLink[] }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    if (!normalized) {
      return [];
    }
    return items
      .filter((item) => `${item.label} ${item.description}`.toLocaleLowerCase("tr-TR").includes(normalized))
      .slice(0, 12);
  }, [items, query]);

  return (
    <div className="navigation-search">
      <input aria-label="Menü ara" placeholder="Yönetim alanı ara" value={query} onChange={(event) => setQuery(event.target.value)} />
      {matches.length ? (
        <div className="search-results">
          {matches.map((item) => (
            <Link href={item.href} key={`${item.href}-${item.label}`}>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FavoritesMenu({ items }: { readonly items: readonly ManagementLink[] }) {
  const favorites = items.filter((item) => ["/tenants", "/marketplace/sellers", "/catalog/products", "/orders", "/commerce/medusa"].includes(item.href));
  return (
    <section className="compact-menu">
      <h3>Favoriler</h3>
      {favorites.map((item) => (
        <Link href={item.href} key={`${item.href}-${item.label}`}>
          {item.label}
        </Link>
      ))}
    </section>
  );
}

export function RecentMenu({ items }: { readonly items: readonly ManagementLink[] }) {
  const recent = items.filter((item) => ["/erp/odoo", "/finance/wallets", "/modules", "/settings"].includes(item.href));
  return (
    <section className="compact-menu">
      <h3>Son Kullanılanlar</h3>
      {recent.map((item) => (
        <Link href={item.href} key={`${item.href}-${item.label}`}>
          {item.label}
        </Link>
      ))}
    </section>
  );
}

export function WorkspaceSwitcher({ workspaces }: { readonly workspaces: readonly ManagementLink[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const current = workspaces.find((workspace) => pathname === workspace.href || (workspace.href !== "/" && pathname.startsWith(`${workspace.href}/`)));

  return (
    <label className="workspace-switcher">
      <span>Alan seç</span>
      <select value={current?.href ?? "/"} onChange={(event) => router.push(event.target.value)}>
        {workspaces.map((workspace) => (
          <option key={`${workspace.href}-${workspace.label}`} value={workspace.href}>
            {workspace.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CommandPalette({ items }: { readonly items: readonly ManagementLink[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return (normalized
      ? items.filter((item) => `${item.label} ${item.description}`.toLocaleLowerCase("tr-TR").includes(normalized))
      : items.slice(0, 10)
    ).slice(0, 20);
  }, [items, query]);

  return (
    <div className="command-palette">
      <button type="button" onClick={() => setOpen((value) => !value)}>
        Komut Paleti
      </button>
      {open ? (
        <div className="command-panel" role="dialog" aria-label="Komut paleti">
          <input autoFocus placeholder="Yönetim alanı veya işlem ara" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div>
            {matches.map((item) => (
              <Link href={item.href} key={`${item.href}-${item.label}`} onClick={() => setOpen(false)}>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AdminSidebar({
  currentPath
}: {
  readonly currentPath: string;
}) {
  const visibleItems = primarySidebarItems;

  return (
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/">
        <span className="admin-brand-mark">ZC</span>
        <div>
          <strong>Commerce OS</strong>
          <small>Central Admin</small>
        </div>
      </Link>
      <NavigationSearch items={searchableManagementLinks} />
      <nav className="workspace-nav" aria-label="Ana yönetim alanları">
        <small className="nav-section-label">Yönetim</small>
        {visibleItems.map((item) => {
          const active = currentPath === item.href || (item.href !== "/" && currentPath.startsWith(`${item.href}/`));
          return (
            <Link className="workspace-link" data-active={active ? "true" : "false"} href={item.href} key={`${item.href}-${item.label}`}>
              <span className="workspace-icon">{item.label.slice(0, 2).toLocaleUpperCase("tr-TR")}</span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function AdminTopbar({
  principal,
  onLogout
}: {
  readonly principal?: PrincipalView | undefined;
  readonly onLogout?: () => void;
}) {
  return (
    <header className="admin-topbar">
      <WorkspaceSwitcher workspaces={primarySidebarItems} />
      <CommandPalette items={searchableManagementLinks} />
      <div className="principal-chip">
        <strong>{principal?.name ?? principal?.email ?? "Kullanıcı"}</strong>
        <span>{principal?.roles?.join(", ") ?? "role yok"}</span>
      </div>
      {onLogout ? (
        <button className="topbar-logout" type="button" onClick={onLogout}>
          Çıkış
        </button>
      ) : null}
    </header>
  );
}

export function AdminShell({
  navigation,
  principal,
  children
}: {
  readonly navigation: readonly NavigationItem[];
  readonly principal?: PrincipalView | undefined;
  readonly children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  void navigation;

  return (
    <main className="admin-shell">
      <AdminSidebar currentPath={pathname} />
      <section className="admin-main">
        <AdminTopbar principal={principal} onLogout={logout} />
        <div className="admin-content">{children}</div>
      </section>
    </main>
  );
}
