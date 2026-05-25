import { fetchOperationsCenter, type OperationsCenterPayload } from "@/lib/runtime-api";

export const dynamic = "force-dynamic";

const navItems = [
  ["operations", "Operasyon"],
  ["tenants", "Tenant"],
  ["events", "Realtime"],
  ["bridges", "Bridge"],
  ["audit", "Audit"],
  ["ai", "AI Ops"]
] as const;

function countOf(value: readonly unknown[] | undefined) {
  return value?.length ?? 0;
}

function EmptyState({ payload }: { readonly payload: OperationsCenterPayload }) {
  const empty = payload.emptyState?.premiumEmptyState;
  if (!empty) {
    return null;
  }

  return (
    <section className="empty-ops" aria-label="Operasyonel boş durum">
      <p className="eyebrow">{payload.emptyState?.resource}</p>
      <h2>{empty.title}</h2>
      <p>{empty.message}</p>
      <span>{empty.action}</span>
    </section>
  );
}

function MetricStrip({ payload }: { readonly payload: OperationsCenterPayload }) {
  const center = payload.operationsCenter;
  const metrics = [
    ["Tenant", countOf(center?.tenantTopologyMap)],
    ["Workspace", countOf(center?.workspaceRegistry)],
    ["Queue State", countOf(center?.queueMonitoring)],
    ["Audit Event", countOf(center?.auditCenter)],
    ["AI Signal", countOf(center?.aiOperationsCenter?.signals)]
  ] as const;

  return (
    <section className="metric-strip" aria-label="Gerçek runtime özetleri">
      {metrics.map(([label, value]) => (
        <article className="metric-cell" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

export default async function CentralAdminPage() {
  const payload = await fetchOperationsCenter();
  const center = payload.operationsCenter;
  const odooOperations = center?.orchestrationCenter?.odoo ?? [];
  const medusaOperations = center?.orchestrationCenter?.medusa ?? [];

  return (
    <main className="control-shell">
      <aside className="workspace-rail" aria-label="Global Operations Center">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            ZC
          </div>
          <div>
            <p>Zyber Cart</p>
            <strong>Commerce OS</strong>
          </div>
        </div>

        <nav className="adaptive-nav" aria-label="Operasyon navigasyonu">
          {navItems.map(([id, label]) => (
            <a href={`#${id}`} key={id}>
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <section className="workspace-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Global Operations Center</p>
            <h1>Commerce Operating System runtime kontrol kulesi</h1>
            <div className="runtime-badges">
              <span>{payload.status}</span>
              <span>{payload.correlationId ?? "correlation bekleniyor"}</span>
              <span>{payload.traceId ?? "trace bekleniyor"}</span>
            </div>
          </div>
          <div className="command-box" role="search">
            <span aria-hidden="true">⌘</span>
            <input aria-label="Global runtime search" placeholder="Tenant, event, queue, audit veya bridge ara" />
          </div>
        </header>

        <EmptyState payload={payload} />
        <MetricStrip payload={payload} />

        <section className="operations-band" id="operations" aria-label="NOC operasyon merkezi">
          <div className="section-heading">
            <p className="eyebrow">NOC / SOC Runtime</p>
            <h2>Gerçek operasyon sinyalleri</h2>
          </div>
          <div className="operations-grid">
            <article className="operation-tile">
              <span />
              <p>Runtime topology graph</p>
              <strong>{center?.runtimeTopologyGraph ? "bağlı" : "beklemede"}</strong>
            </article>
            <article className="operation-tile">
              <span />
              <p>Sync topology graph</p>
              <strong>{countOf(center?.syncTopologyGraph)}</strong>
            </article>
            <article className="operation-tile">
              <span />
              <p>Worker monitoring</p>
              <strong>{center?.workerMonitoring?.state ?? "empty"}</strong>
            </article>
            <article className="operation-tile">
              <span />
              <p>Billing visibility</p>
              <strong>{center?.billingVisibility?.state ?? "empty"}</strong>
            </article>
          </div>
        </section>

        <section className="split-band" id="tenants">
          <div className="section-heading">
            <p className="eyebrow">Tenant Lifecycle</p>
            <h2>Tenant topology ve workspace registry</h2>
          </div>
          <div className="runtime-grid">
            {(center?.workspaceRegistry ?? []).map((workspace) => (
              <article className="runtime-card" key={`${workspace.workspace_id}-${workspace.workspace_type}`}>
                <h3>{workspace.workspace_type ?? "workspace"}</h3>
                <p>{workspace.workspace_id ?? "workspace id bekleniyor"}</p>
                <span>{workspace.enabled ? "aktif" : "kapalı"}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="split-band" id="events">
          <div className="section-heading">
            <p className="eyebrow">Realtime Event Fabric</p>
            <h2>Tenant ve workspace izole channel görünürlüğü</h2>
          </div>
          <div className="event-flow">
            {(center?.realtimeEventStream ?? []).map((channel) => (
              <article className="event-card" key={`${channel.channel}-${channel.subscriptionPath}`}>
                <h3>{channel.channel ?? "channel"}</h3>
                <p>{channel.subscriptionPath ?? "subscription path bekleniyor"}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bridge-band" id="bridges">
          <div className="section-heading">
            <p className="eyebrow">Engine Orchestration</p>
            <h2>Odoo ve Medusa operational bridge surface</h2>
          </div>
          <div className="bridge-grid">
            <article className="bridge-panel">
              <h3>Odoo Operational Bridge</h3>
              <p>Raw Odoo UI kapalıdır; sadece gateway kontrollü operasyonlar görünür.</p>
              <ul>
                {odooOperations.map((operation) => (
                  <li key={operation.operation}>{operation.operation}</li>
                ))}
              </ul>
            </article>
            <article className="bridge-panel">
              <h3>Medusa Commerce Orchestration</h3>
              <p>Admin UI kapalıdır; headless engine operasyonları izlenir.</p>
              <ul>
                {medusaOperations.map((operation) => (
                  <li key={operation.operation}>{operation.operation}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="runtime-band" id="audit">
          <div className="section-heading">
            <p className="eyebrow">Audit / Security</p>
            <h2>Correlation ve trace görünürlüğü</h2>
          </div>
          <div className="runtime-grid">
            {(center?.auditCenter ?? []).map((event, index) => (
              <article className="runtime-card" key={index}>
                <h3>Audit event</h3>
                <p>{JSON.stringify(event)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="runtime-band" id="ai">
          <div className="section-heading">
            <p className="eyebrow">AI Operations Layer</p>
            <h2>AI sinyalleri ve izolasyon kontratları</h2>
          </div>
          <div className="runtime-grid">
            {(center?.aiOperationsCenter?.contracts ?? []).map((contract) => (
              <article className="runtime-card" key={contract}>
                <h3>{contract}</h3>
                <p>Gerçek sinyal geldiğinde audit ve tenant scope ile görünür.</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
