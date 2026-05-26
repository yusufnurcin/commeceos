"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type JsonRecord = Record<string, unknown>;
const tenantThemeAuditActions = new Set(["theme_assigned", "theme_settings_updated", "theme_assignment_blocked", "theme_required_module_missing"]);

function value(source: JsonRecord | undefined, key: string, fallback: string) {
  const next = source?.[key];
  return typeof next === "string" && next ? next : fallback;
}

async function readJson(response: Response) {
  return response.json().catch(() => ({ status: "response_unavailable" })) as Promise<JsonRecord>;
}

function missingModulesFromPayload(payload: JsonRecord) {
  return Array.isArray(payload.missingModules) ? payload.missingModules.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function missingModuleMessage(modules: readonly string[]) {
  if (!modules.length) {
    return "Bu tema için gerekli modüller aktif değil. Önce Modül Merkezi'nden eksik modülleri aktif edin.";
  }

  const names = modules.join(", ");
  return `Bu tema için ${names} modülü aktif olmalı. Önce Modül Merkezi'nden ${names} modülünü aktif edin.`;
}

function themeErrorMessage(payload: JsonRecord, fallback: string) {
  switch (payload.status) {
    case "theme_required_module_missing":
      return missingModuleMessage(missingModulesFromPayload(payload));
    case "theme_not_found":
      return "Tema bulunamadı.";
    case "tenant_not_found":
      return "Tenant bulunamadı.";
    case "theme_assignment_not_found":
      return "Bu tenant için henüz tema seçilmedi.";
    case "theme_settings_invalid":
      return "Tema ayarları geçerli değil.";
    default:
      return fallback;
  }
}

export default function TenantDetailPage({ params }: { readonly params: Promise<{ readonly id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [payload, setPayload] = useState<JsonRecord | null>(null);
  const [themePayload, setThemePayload] = useState<JsonRecord | null>(null);
  const [themes, setThemes] = useState<readonly JsonRecord[]>([]);
  const [selectedThemeKey, setSelectedThemeKey] = useState("tenant_default");
  const [settingKey, setSettingKey] = useState("density");
  const [settingValue, setSettingValue] = useState("comfortable");
  const [themeMessage, setThemeMessage] = useState<string | null>(null);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [missingModules, setMissingModules] = useState<readonly string[]>([]);
  const [themeBusy, setThemeBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadThemeState = useCallback(async () => {
    const [tenantThemeResponse, themesResponse] = await Promise.all([
      fetch(`/api/tenants/${encodeURIComponent(id)}/theme`, { cache: "no-store" }),
      fetch("/api/themes", { cache: "no-store" })
    ]);
    if (tenantThemeResponse.status === 401 || themesResponse.status === 401) {
      router.replace("/login");
      return;
    }

    const tenantThemeBody = await readJson(tenantThemeResponse);
    const themesBody = await readJson(themesResponse);
    setThemePayload(tenantThemeBody);
    setThemes((themesBody.themes as readonly JsonRecord[] | undefined) ?? []);

    const currentTheme = (tenantThemeBody.assignment as JsonRecord | undefined)?.theme as JsonRecord | undefined;
    const currentKey = value(currentTheme, "key", "");
    if (currentKey) {
      setSelectedThemeKey(currentKey);
    }
  }, [id, router]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/tenants/${encodeURIComponent(id)}`, { cache: "no-store" }).then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }
        return (await response.json()) as JsonRecord;
      }),
      loadThemeState()
    ])
      .then(([body]) => setPayload(body))
      .finally(() => setLoading(false));
  }, [id, loadThemeState, router]);

  async function assignTheme() {
    setThemeBusy(true);
    setThemeMessage(null);
    setThemeError(null);
    setMissingModules([]);
    const response = await fetch(`/api/tenants/${encodeURIComponent(id)}/theme/assign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ themeKey: selectedThemeKey, settings: { source: "tenant-detail" } })
    });
    const body = await readJson(response);
    setThemeBusy(false);

    if (!response.ok) {
      setMissingModules(missingModulesFromPayload(body));
      setThemeError(themeErrorMessage(body, "Tema atanamadı."));
      return;
    }

    setThemeMessage("Tema bu tenant için aktif edildi.");
    await loadThemeState();
  }

  async function saveThemeSettings() {
    const normalizedKey = settingKey.trim();
    if (!normalizedKey) {
      setThemeError("Ayar anahtarı gerekli.");
      return;
    }

    setThemeBusy(true);
    setThemeMessage(null);
    setThemeError(null);
    setMissingModules([]);
    const response = await fetch(`/api/tenants/${encodeURIComponent(id)}/theme/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings: { [normalizedKey]: settingValue } })
    });
    const body = await readJson(response);
    setThemeBusy(false);

    if (!response.ok) {
      setThemeError(themeErrorMessage(body, "Tema ayarları kaydedilemedi."));
      return;
    }

    setThemeMessage("Tema ayarları kaydedildi.");
    await loadThemeState();
  }

  if (loading) {
    return <main className="centered-runtime">Tenant bilgileri yükleniyor</main>;
  }

  const tenant = payload?.tenant as JsonRecord | undefined;
  const workspaces = (payload?.workspaces as readonly JsonRecord[] | undefined) ?? [];
  const auditEvents = (payload?.auditEvents as readonly JsonRecord[] | undefined) ?? [];
  const namespaces = (payload?.namespaces as JsonRecord | undefined) ?? {};
  const bridgeState = (payload?.bridgeState as JsonRecord | undefined) ?? {};
  const themeAssignment = themePayload?.assignment as JsonRecord | null | undefined;
  const activeTheme = themeAssignment?.theme as JsonRecord | undefined;
  const themeEvents = ((themePayload?.events as readonly JsonRecord[] | undefined) ?? [])
    .filter((event) => tenantThemeAuditActions.has(String(event.event_type ?? "")))
    .slice(0, 10);
  const visibleAuditEvents = auditEvents
    .filter((event) => tenantThemeAuditActions.has(String(event.action ?? "")))
    .slice(0, 10);
  const firstMissingModule = missingModules[0];

  return (
    <main className="detail-shell">
      <nav className="breadcrumb">
        <Link href="/">Ana Panel</Link>
        <Link href="/tenants">Tenantlar</Link>
        <span>{id}</span>
      </nav>
      <header className="detail-header">
        <div>
          <h1>{value(tenant, "display_name", value(tenant, "tenant_id", id))}</h1>
          <p>
            {value(tenant, "lifecycle_state", "Durum bekleniyor")} · {value(tenant, "default_currency", "Para birimi yok")} ·{" "}
            {value(tenant, "timezone", "Zaman dilimi yok")}
          </p>
        </div>
        <mark>{String(payload?.status ?? "Hazırlanıyor")}</mark>
      </header>

      <section className="runtime-section two-column">
        <article className="runtime-panel">
          <h2>Workspace listesi</h2>
          {workspaces.length === 0 ? (
            <div className="empty-state">Bu tenant için workspace kaydı henüz oluşmadı.</div>
          ) : (
            workspaces.map((workspace) => (
              <div className="data-row" key={String(workspace.workspace_id)}>
                <strong>{String(workspace.workspace_type ?? "Workspace")}</strong>
                <span>{String(workspace.workspace_id ?? "Kimlik bekleniyor")}</span>
              </div>
            ))
          )}
        </article>
        <article className="runtime-panel">
          <h2>İzolasyon ve köprü durumu</h2>
          <div className="operation-grid">
            <div className="operation-card">
              <strong>Depolama Alanı</strong>
              <span>{String(namespaces.storage ?? "Storage alanı tenant provisioning ile oluşacak.")}</span>
            </div>
            <div className="operation-card">
              <strong>Realtime Kanalı</strong>
              <span>{String(namespaces.realtime ?? "Realtime kanalı tenant aktifleşince bağlanacak.")}</span>
            </div>
            <div className="operation-card">
              <strong>Odoo Köprüsü</strong>
              <span>{String(bridgeState.odoo ?? "Odoo mapping bekleniyor.")}</span>
            </div>
            <div className="operation-card">
              <strong>Medusa Köprüsü</strong>
              <span>{String(bridgeState.medusa ?? "Medusa bridge bekleniyor.")}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="runtime-section">
        <div className="data-toolbar">
          <div>
            <h2>Tema</h2>
            <p>Tenant storefront tema seçimi ve ayarları gerçek Theme Registry API üzerinden yönetilir.</p>
          </div>
        </div>
        {themeMessage ? <p className="form-success">{themeMessage}</p> : null}
        {themeError ? <p className="form-error">{themeError}</p> : null}
        {missingModules.length ? (
          <div className="dependency-notice">
            <strong>Eksik modül: {missingModules.join(", ")}</strong>
            <span>{missingModuleMessage(missingModules)}</span>
            <Link href={`/modules?highlight=${encodeURIComponent(firstMissingModule ?? "")}`}>Eksik Modülleri Aç</Link>
          </div>
        ) : null}
        <div className="theme-assignment-grid">
          <article className="runtime-panel">
            <h3>Aktif tema</h3>
            {themeAssignment ? (
              <div className="operation-card">
                <strong>{value(activeTheme, "name", "Tema")}</strong>
                <span>
                  {value(activeTheme, "industry", "Sektör yok")} · {value(activeTheme, "category", "Kategori yok")}
                </span>
                <small>{value(themeAssignment, "status", "Durum yok")}</small>
              </div>
            ) : (
              <div className="empty-state">Bu tenant için henüz tema seçilmedi.</div>
            )}
          </article>
          <article className="runtime-panel">
            <h3>Tema değiştir</h3>
            <label>
              Tema
              <select value={selectedThemeKey} onChange={(event) => setSelectedThemeKey(event.target.value)}>
                {themes.map((theme) => (
                  <option value={String(theme.key)} key={String(theme.key)}>
                    {String(theme.name)} · {String(theme.industry)}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={themeBusy || themes.length === 0} type="button" onClick={assignTheme}>
              Tema Ata
            </button>
          </article>
          <article className="runtime-panel">
            <h3>Tema ayarları</h3>
            <label>
              Ayar anahtarı
              <input value={settingKey} onChange={(event) => setSettingKey(event.target.value)} />
            </label>
            <label>
              Ayar değeri
              <input value={settingValue} onChange={(event) => setSettingValue(event.target.value)} />
            </label>
            <button disabled={themeBusy || !themeAssignment} type="button" onClick={saveThemeSettings}>
              Ayarları Kaydet
            </button>
          </article>
          <article className="runtime-panel">
            <h3>Tema olayları</h3>
            {themeEvents.length ? (
              <div className="audit-mini-timeline">
                {themeEvents.map((event) => (
                  <article key={String(event.id)}>
                    <strong>{String(event.event_type ?? "theme.event")}</strong>
                    <small>{String(event.created_at ?? "Zaman yok")}</small>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">Tema event kaydı henüz yok.</div>
            )}
          </article>
        </div>
      </section>

      <section className="runtime-section">
        <div className="data-toolbar">
          <div>
            <h2>Tema audit olayları</h2>
            <p>Bu bölüm yalnızca tenant tema atama, ayar ve eksik modül olaylarını gösterir.</p>
          </div>
          <Link className="secondary-link" href="/audit">
            Tüm audit kayıtlarını gör
          </Link>
        </div>
        {visibleAuditEvents.length === 0 ? (
          <div className="empty-state">Bu tenant için tema audit olayı henüz oluşmadı.</div>
        ) : (
          <div className="audit-mini-timeline">
            {visibleAuditEvents.map((event, index) => (
              <article key={String(event.audit_id ?? index)}>
                <strong>{String(event.action ?? "Tenant olayı")}</strong>
                <span>{String(event.result ?? "Sonuç bekleniyor")}</span>
                <small>{String(event.occurred_at ?? "Zaman bekleniyor")}</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
