"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const initialVisibleThemeCount = 24;
const visibleThemeStep = 24;

export interface ThemeModuleView {
  readonly key: string;
  readonly isEnabled: boolean;
  readonly status: string;
}

export interface PlatformThemeView {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly industry: string;
  readonly category: string;
  readonly status: string;
  readonly version: string;
  readonly isCore: boolean;
  readonly isPremium: boolean;
  readonly supportsDarkMode: boolean;
  readonly supportsMobile: boolean;
  readonly supportsRtl: boolean;
  readonly requiredModules: readonly string[];
  readonly capabilities?: unknown;
}

export interface TenantOptionView {
  readonly tenant_id?: string;
  readonly display_name?: string;
}

async function readJson(response: Response) {
  return response.json().catch(() => ({ status: "response_unavailable" })) as Promise<Record<string, unknown>>;
}

function missingModulesFromPayload(payload: Record<string, unknown>) {
  return Array.isArray(payload.missingModules) ? payload.missingModules.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function missingModuleMessage(modules: readonly string[]) {
  if (!modules.length) {
    return "Bu tema için gerekli modüller aktif değil. Önce Modül Merkezi'nden eksik modülleri aktif edin.";
  }

  const names = modules.join(", ");
  return `Bu tema için ${names} modülü aktif olmalı. Önce Modül Merkezi'nden ${names} modülünü aktif edin.`;
}

function errorMessage(payload: Record<string, unknown>, fallback: string) {
  switch (payload.status) {
    case "theme_required_module_missing":
      return missingModuleMessage(missingModulesFromPayload(payload));
    case "theme_not_found":
      return "Tema bulunamadı.";
    case "tenant_not_found":
      return "Tenant bulunamadı.";
    case "theme_assignment_payload_invalid":
      return "Tema atama bilgileri geçerli değil.";
    case "auth_required":
      return "Oturum gerekli.";
    case "theme_access_denied":
      return "Bu işlem için tema yönetimi yetkisi gerekli.";
    case "runtime_store_unavailable":
      return "Tema kayıt servisine ulaşılamıyor.";
    default:
      return fallback;
  }
}

export function ThemeRegistryPanel({
  initialThemes,
  tenants,
  module
}: {
  readonly initialThemes: readonly PlatformThemeView[];
  readonly tenants: readonly TenantOptionView[];
  readonly module?: ThemeModuleView | null;
}) {
  const [themes, setThemes] = useState<readonly PlatformThemeView[]>(initialThemes);
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("all");
  const [category, setCategory] = useState("all");
  const [selectedKey, setSelectedKey] = useState(initialThemes[0]?.key ?? "");
  const [tenantId, setTenantId] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(initialVisibleThemeCount);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingModules, setMissingModules] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);

  const industries = useMemo(() => Array.from(new Set(themes.map((theme) => theme.industry))).sort((a, b) => a.localeCompare(b, "tr")), [themes]);
  const categories = useMemo(() => Array.from(new Set(themes.map((theme) => theme.category))).sort((a, b) => a.localeCompare(b, "tr")), [themes]);
  const selectedTheme = useMemo(() => themes.find((theme) => theme.key === selectedKey) ?? themes[0], [themes, selectedKey]);
  const filteredThemes = useMemo(
    () =>
      themes.filter((theme) => {
        const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
        const industryMatch = industry === "all" || theme.industry === industry;
        const categoryMatch = category === "all" || theme.category === category;
        const queryMatch =
          !normalizedQuery ||
          [theme.name, theme.key, theme.description, theme.industry, theme.category, theme.requiredModules.join(" ")]
            .join(" ")
            .toLocaleLowerCase("tr-TR")
            .includes(normalizedQuery);
        return industryMatch && categoryMatch && queryMatch;
      }),
    [themes, query, industry, category]
  );
  const visibleThemes = useMemo(() => filteredThemes.slice(0, visibleLimit), [filteredThemes, visibleLimit]);
  const firstMissingModule = missingModules[0];

  useEffect(() => {
    setVisibleLimit(initialVisibleThemeCount);
  }, [query, industry, category]);

  async function refreshThemes() {
    setError(null);
    setMissingModules([]);
    const response = await fetch("/api/themes", { cache: "no-store" });
    const payload = await readJson(response);
    if (!response.ok) {
      setError(errorMessage(payload, "Tema listesi alınamadı."));
      return;
    }
    setThemes((payload.themes as PlatformThemeView[] | undefined) ?? []);
  }

  async function assignTheme(themeKey: string) {
    if (!tenantId) {
      setError("Tema atamak için önce tenant seçin.");
      return;
    }

    setBusy(true);
    setMessage(null);
    setError(null);
    setMissingModules([]);
    const response = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/theme/assign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ themeKey, settings: { source: "central-admin-theme-registry" } })
    });
    const payload = await readJson(response);
    setBusy(false);

    if (!response.ok) {
      setMissingModules(missingModulesFromPayload(payload));
      setError(errorMessage(payload, "Tema tenant'a atanamadı."));
      return;
    }

    setMessage("Tema tenant'a atandı.");
  }

  return (
    <section className="theme-registry-panel">
      {module && !module.isEnabled ? (
        <div className="module-disabled-warning">
          <strong>Temalar modülü pasif</strong>
          <span>Tema kataloğu okunabilir; tenant ataması yapmak için önce Modül Registry üzerinden temalar modülünü etkinleştirin.</span>
          <Link href="/modules">Modül Registry</Link>
        </div>
      ) : null}

      <div className="module-registry-toolbar">
        <div>
          <h2>Tema kataloğu</h2>
          <p>{themes.length} sektör tema manifesti Gateway API ve PostgreSQL Theme Registry üzerinden geliyor.</p>
        </div>
        <button type="button" onClick={refreshThemes}>
          Listeyi Yenile
        </button>
      </div>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {missingModules.length ? (
        <div className="dependency-notice">
          <strong>Eksik modül: {missingModules.join(", ")}</strong>
          <span>{missingModuleMessage(missingModules)}</span>
          <Link href={`/modules?highlight=${encodeURIComponent(firstMissingModule ?? "")}`}>Eksik Modülleri Aç</Link>
        </div>
      ) : null}

      <div className="theme-filter-bar">
        <label>
          Tema ara
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sektör, tema veya modül adı" />
        </label>
        <label>
          Sektör
          <select value={industry} onChange={(event) => setIndustry(event.target.value)}>
            <option value="all">Tüm sektörler</option>
            {industries.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kategori
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">Tüm kategoriler</option>
            {categories.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tenant
          <select value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
            <option value="">Tenant seçin</option>
            {tenants.length ? null : <option value="">Tenant yok</option>}
            {tenants.map((tenant) => (
              <option value={tenant.tenant_id} key={tenant.tenant_id}>
                {tenant.display_name ?? tenant.tenant_id}
              </option>
            ))}
          </select>
        </label>
        <span>
          {filteredThemes.length} tema filtrelendi, {visibleThemes.length} tema gösteriliyor
        </span>
      </div>

      {!tenantId ? <p className="form-hint">Tema ataması yapmak için önce tenant seçin.</p> : null}

      <div className="theme-registry-layout">
        <div className="theme-grid">
          {visibleThemes.map((theme) => (
            <article className="theme-card" key={theme.key} data-selected={selectedTheme?.key === theme.key ? "true" : "false"}>
              <header>
                <div>
                  <h3>{theme.name}</h3>
                  <p>{theme.description}</p>
                </div>
                <mark>{theme.isPremium ? "Premium" : "Core"}</mark>
              </header>
              <dl>
                <div>
                  <dt>Sektör</dt>
                  <dd>{theme.industry}</dd>
                </div>
                <div>
                  <dt>Kategori</dt>
                  <dd>{theme.category}</dd>
                </div>
                <div>
                  <dt>Sürüm</dt>
                  <dd>{theme.version}</dd>
                </div>
              </dl>
              <div className="module-badges">
                {theme.supportsDarkMode ? <span>Koyu mod</span> : null}
                {theme.supportsMobile ? <span>Mobil</span> : null}
                {theme.supportsRtl ? <span>RTL</span> : null}
                {theme.requiredModules.length ? <span>Modül: {theme.requiredModules.join(", ")}</span> : <span>Ek modül yok</span>}
              </div>
              <div className="module-registry-actions">
                <button type="button" onClick={() => setSelectedKey(theme.key)}>
                  Detay
                </button>
                <button disabled={busy || !tenantId} type="button" onClick={() => assignTheme(theme.key)}>
                  Tenant Ataması Yap
                </button>
              </div>
            </article>
          ))}
          {visibleThemes.length < filteredThemes.length ? (
            <button className="load-more-button" type="button" onClick={() => setVisibleLimit((current) => current + visibleThemeStep)}>
              Daha fazla göster
            </button>
          ) : null}
          {!filteredThemes.length ? (
            <div className="empty-state">Bu filtrelerle eşleşen tema yok. Arama veya filtreleri değiştirin.</div>
          ) : null}
        </div>

        <aside className="module-registry-detail">
          <h2>{selectedTheme?.name ?? "Tema seçin"}</h2>
          {selectedTheme ? (
            <>
              <p>{selectedTheme.description}</p>
              <div className="theme-detail-stack">
                <strong>Key</strong>
                <span>{selectedTheme.key}</span>
                <strong>Gerekli modüller</strong>
                <span>{selectedTheme.requiredModules.length ? selectedTheme.requiredModules.join(", ") : "Yok"}</span>
                <strong>Yetenekler</strong>
                <span>{Array.isArray(selectedTheme.capabilities) ? selectedTheme.capabilities.join(", ") : "Manifest yetenekleri kayıtlı"}</span>
              </div>
              <button disabled={busy || !tenantId} type="button" onClick={() => assignTheme(selectedTheme.key)}>
                Seçili Temayı Tenant İçin Ata
              </button>
            </>
          ) : (
            <p>Theme Registry boş. Bootstrap çalışınca 90 sektör tema manifesti burada görünür.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
