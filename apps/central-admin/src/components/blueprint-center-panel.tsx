"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  blueprintStats,
  blueprintStatusLabels,
  capabilityBlueprints,
  panelBlueprints,
  pdfSourcePanels,
  providerBlueprints,
  type BlueprintStatus
} from "@/config/panel-blueprint";

const statusOptions: readonly BlueprintStatus[] = [
  "runtime_ready",
  "planned",
  "provider_required",
  "integration_required",
  "enterprise_risk",
  "license_review_required",
  "disabled"
];

function BlueprintStatusBadge({ status }: { readonly status: BlueprintStatus }) {
  return (
    <span className="blueprint-status-badge" data-status={status}>
      {blueprintStatusLabels[status]}
    </span>
  );
}

export function BlueprintCenterPanel() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<BlueprintStatus | "all">("all");
  const [panel, setPanel] = useState("all");
  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  const visibleCapabilities = useMemo(
    () =>
      capabilityBlueprints.filter((item) => {
        const matchesQuery =
          !normalizedQuery ||
          `${item.label} ${item.description} ${item.moduleKey} ${item.permissionPrefix} ${item.providerKey ?? ""}`
            .toLocaleLowerCase("tr-TR")
            .includes(normalizedQuery);
        const matchesStatus = status === "all" || item.status === status;
        const matchesPanel = panel === "all" || item.panelTargets.includes(panel);
        return matchesQuery && matchesStatus && matchesPanel;
      }),
    [normalizedQuery, panel, status]
  );

  return (
    <div className="blueprint-center">
      <section className="blueprint-hero">
        <div>
          <span>PDF kapsam uzlaştırması</span>
          <h2>Commerce OS Panel Blueprint</h2>
          <p>
            PDF içindeki bütün kapsam korunur. Çalışan çekirdekler, planlanan alanlar ve provider gerektiren
            yüzeyler aynı listede fakat dürüst durum rozetleriyle ayrılır.
          </p>
        </div>
        <nav aria-label="Blueprint bölümleri">
          <a href="#panels">Paneller</a>
          <a href="#capabilities">Modüller</a>
          <a href="#providers">Providerlar</a>
          <a href="#source-inventory">PDF Kaynağı</a>
        </nav>
      </section>

      <section className="blueprint-metric-grid" aria-label="PDF hedef özeti">
        <article><strong>{blueprintStats.panelCount}</strong><span>PDF paneli</span></article>
        <article><strong>{blueprintStats.menuGroupCount}</strong><span>Menü grubu hedefi</span></article>
        <article><strong>{blueprintStats.menuItemCount}</strong><span>Menü öğesi hedefi</span></article>
        <article><strong>{blueprintStats.permissionCount}</strong><span>Permission hedefi</span></article>
        <article><strong>{blueprintStats.indexedCapabilityCount}</strong><span>Normalize ana kapasite</span></article>
        <article><strong>{blueprintStats.providerCount}</strong><span>Provider sınıfı</span></article>
      </section>

      <section className="dashboard-section" id="panels">
        <header className="blueprint-section-header">
          <div>
            <h2>15 panel projeksiyonu</h2>
            <p>PDF panel adları metadata içinde korunur; günlük iş akışları doğru workspace hedeflerine ayrılır.</p>
          </div>
        </header>
        <div className="blueprint-panel-grid">
          {panelBlueprints.map((item) => (
            <article className="blueprint-panel-card" id={`panel-${item.panelKey}`} key={item.panelKey}>
              <header>
                <div>
                  <small>{item.routePrefix}</small>
                  <h3>{item.panelName}</h3>
                </div>
                <span>{item.tenantScope === "tenant" ? "Tenant kapsamı" : item.tenantScope === "mixed" ? "Karma kapsam" : "Global"}</span>
              </header>
              <p>{item.audience}</p>
              <dl>
                <div><dt>Roller</dt><dd>{item.roleTargets.join(", ")}</dd></div>
                <div><dt>Modüller</dt><dd>{item.moduleBindings.join(", ")}</dd></div>
              </dl>
              <div className="blueprint-chip-row">
                {item.menuGroups.map((group) => <span key={`${item.panelKey}-${group}`}>{group}</span>)}
              </div>
              <footer>
                <small>PDF kaynağı: {item.metadata.sourceName}</small>
                <a href="#capabilities">Kapasiteyi incele</a>
              </footer>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section" id="capabilities">
        <header className="blueprint-section-header">
          <div>
            <h2>Normalize modül ve özellik kapsamı</h2>
            <p>Sidebar kalabalığı oluşturmadan PDF kapsamını arayın ve bağlı yüzeye gidin.</p>
          </div>
          <small>{visibleCapabilities.length} / {capabilityBlueprints.length} kapasite gösteriliyor</small>
        </header>
        <div className="blueprint-filter-bar">
          <label>
            <span>Ara</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Odoo, kargo, cüzdan, fatura, tema..." />
          </label>
          <label>
            <span>Durum</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as BlueprintStatus | "all")}>
              <option value="all">Tüm durumlar</option>
              {statusOptions.map((item) => <option value={item} key={item}>{blueprintStatusLabels[item]}</option>)}
            </select>
          </label>
          <label>
            <span>Panel</span>
            <select value={panel} onChange={(event) => setPanel(event.target.value)}>
              <option value="all">Tüm paneller</option>
              {panelBlueprints.map((item) => <option value={item.panelKey} key={item.panelKey}>{item.panelName}</option>)}
            </select>
          </label>
        </div>
        <div className="blueprint-capability-list">
          {visibleCapabilities.map((item) => (
            <article id={`capability-${item.key}`} key={item.key}>
              <div>
                <header>
                  <h3>{item.label}</h3>
                  <BlueprintStatusBadge status={item.status} />
                </header>
                <p>{item.description}</p>
                <small>Panel: {item.panelTargets.join(", ")} · Yetki alanı: {item.permissionPrefix}.*</small>
              </div>
              <div className="blueprint-capability-action">
                {item.providerKey ? <span>{item.providerKey}</span> : null}
                {item.route ? <Link href={item.route}>İlgili alana git</Link> : <span>Blueprint içinde</span>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section" id="providers">
        <header className="blueprint-section-header">
          <div>
            <h2>Provider bağlantı noktaları</h2>
            <p>Commerce OS Core bağımsızdır. Harici motor ve servisler ilgili özelliği kısıtlı moda alır; platformu düşürmez.</p>
          </div>
        </header>
        <div className="blueprint-provider-grid">
          {providerBlueprints.map((item) => (
            <article key={item.providerKey}>
              <strong>{item.providerKey}</strong>
              <span>{item.capabilityCount} bağlı kapasite</span>
              <p>{item.capabilities.join(", ")}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section" id="source-inventory">
        <header className="blueprint-section-header">
          <div>
            <h2>PDF kaynak panel envanteri</h2>
            <p>Kaynak sayılar değiştirilmeden tutulur. Normalize panel projeksiyonu bu kaynağı eksiltmez.</p>
          </div>
        </header>
        <div className="blueprint-source-table">
          {pdfSourcePanels.map((item) => (
            <article key={item.sourceName}>
              <div><strong>{item.panelName}</strong><small>{item.sourceName} · {item.routePrefix}</small></div>
              <span>{item.menuGroupCount} grup</span>
              <span>{item.menuItemCount} öğe</span>
              <span>{item.permissionCount} yetki</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
