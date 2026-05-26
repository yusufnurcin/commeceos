"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface PluginModuleView {
  readonly key: string;
  readonly isEnabled: boolean;
  readonly status: string;
}

export interface PlatformPluginView {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly status: string;
  readonly version: string;
  readonly installedVersion?: string | null;
  readonly provider: string;
  readonly sourceType: string;
  readonly isCore: boolean;
  readonly isEnabled: boolean;
  readonly requiresLicense: boolean;
  readonly licenseStatus: string;
  readonly requiredModules: readonly string[];
  readonly permissions: readonly string[];
  readonly capabilities?: unknown;
}

interface PluginEventView {
  readonly id: string;
  readonly event_type: string;
  readonly created_at: string;
}

async function readJson(response: Response) {
  return response.json().catch(() => ({ status: "response_unavailable" })) as Promise<Record<string, unknown>>;
}

function missingModulesFromPayload(payload: Record<string, unknown>) {
  return Array.isArray(payload.missingModules) ? payload.missingModules.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function missingModuleMessage(modules: readonly string[]) {
  if (!modules.length) {
    return "Bu plugin için gerekli modüller aktif değil. Önce Modül Merkezi'nden eksik modülleri aktif edin.";
  }

  const names = modules.join(", ");
  return `Bu plugin için ${names} modülü aktif olmalı. Önce Modül Merkezi'nden ${names} modülünü aktif edin.`;
}

function errorMessage(payload: Record<string, unknown>, fallback: string) {
  switch (payload.status) {
    case "plugin_required_module_missing":
      return missingModuleMessage(missingModulesFromPayload(payload));
    case "plugin_not_found":
      return "Plugin bulunamadı.";
    case "plugin_settings_invalid":
      return "Plugin ayarları geçerli değil.";
    case "auth_required":
      return "Oturum gerekli.";
    case "super_admin_required":
      return "Bu işlem için super admin yetkisi gerekli.";
    case "runtime_store_unavailable":
      return "Plugin kayıt servisine ulaşılamıyor.";
    default:
      return fallback;
  }
}

function statusText(plugin: PlatformPluginView) {
  if (plugin.isEnabled) {
    return "Aktif";
  }
  if (plugin.status === "blocked") {
    return "Engelli";
  }
  return "Pasif";
}

function capabilityText(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").join(", ");
  }
  if (value && typeof value === "object") {
    return "Manifest yetenekleri kayıtlı";
  }
  return "Yetenek bilgisi yok";
}

export function PluginRegistryPanel({
  initialPlugins,
  module
}: {
  readonly initialPlugins: readonly PlatformPluginView[];
  readonly module?: PluginModuleView | null;
}) {
  const [plugins, setPlugins] = useState<readonly PlatformPluginView[]>(initialPlugins);
  const [selectedKey, setSelectedKey] = useState(initialPlugins[0]?.key ?? "");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [events, setEvents] = useState<readonly PluginEventView[]>([]);
  const [settingKey, setSettingKey] = useState("enabledScope");
  const [settingValue, setSettingValue] = useState("platform");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingModules, setMissingModules] = useState<readonly string[]>([]);

  const categories = useMemo(() => Array.from(new Set(plugins.map((plugin) => plugin.category))).sort((a, b) => a.localeCompare(b, "tr")), [plugins]);
  const filteredPlugins = useMemo(
    () =>
      plugins.filter((plugin) => {
        const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
        const categoryMatch = category === "all" || plugin.category === category;
        const queryMatch =
          !normalizedQuery ||
          [plugin.name, plugin.key, plugin.description, plugin.category, plugin.requiredModules.join(" ")]
            .join(" ")
            .toLocaleLowerCase("tr-TR")
            .includes(normalizedQuery);
        return categoryMatch && queryMatch;
      }),
    [plugins, query, category]
  );
  const selectedPlugin = useMemo(() => plugins.find((plugin) => plugin.key === selectedKey) ?? plugins[0], [plugins, selectedKey]);
  const firstMissingModule = missingModules[0];

  async function refreshPlugins() {
    const response = await fetch("/api/plugins", { cache: "no-store" });
    const payload = await readJson(response);
    if (!response.ok) {
      setError(errorMessage(payload, "Plugin listesi alınamadı."));
      return;
    }
    setPlugins((payload.plugins as PlatformPluginView[] | undefined) ?? []);
  }

  async function mutatePlugin(key: string, action: "activate" | "deactivate") {
    setBusyKey(key);
    setMessage(null);
    setError(null);
    setMissingModules([]);
    const response = await fetch(`/api/plugins/${encodeURIComponent(key)}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const payload = await readJson(response);
    setBusyKey(null);

    if (!response.ok) {
      setMissingModules(missingModulesFromPayload(payload));
      setError(errorMessage(payload, "Plugin işlemi başarısız oldu."));
      await loadEvents(key);
      return;
    }

    setMessage(action === "activate" ? "Plugin aktif edildi." : "Plugin pasif hale getirildi.");
    await refreshPlugins();
    await loadEvents(key);
  }

  async function saveSettings(key: string) {
    const normalizedKey = settingKey.trim();
    if (!normalizedKey) {
      setError("Ayar anahtarı gerekli.");
      return;
    }

    setBusyKey(key);
    setMessage(null);
    setError(null);
    setMissingModules([]);
    const response = await fetch(`/api/plugins/${encodeURIComponent(key)}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings: { [normalizedKey]: settingValue } })
    });
    const payload = await readJson(response);
    setBusyKey(null);

    if (!response.ok) {
      setError(errorMessage(payload, "Plugin ayarı kaydedilemedi."));
      return;
    }

    setMessage("Plugin ayarı kaydedildi.");
    await loadEvents(key);
  }

  async function loadEvents(key: string) {
    setSelectedKey(key);
    const response = await fetch(`/api/plugins/${encodeURIComponent(key)}/events`, { cache: "no-store" });
    const payload = await readJson(response);
    if (!response.ok) {
      setError(errorMessage(payload, "Plugin olay geçmişi alınamadı."));
      return;
    }
    setEvents((payload.events as PluginEventView[] | undefined) ?? []);
  }

  return (
    <section className="module-registry-panel">
      {module && !module.isEnabled ? (
        <div className="module-disabled-warning">
          <strong>Pluginler modülü pasif</strong>
          <span>Plugin kataloğu okunabilir; aktivasyon için önce Modül Merkezi üzerinden pluginler modülünü etkinleştirin.</span>
          <Link href="/modules?highlight=plugins">Modül Merkezi</Link>
        </div>
      ) : null}

      <div className="module-registry-toolbar">
        <div>
          <h2>Plugin Registry</h2>
          <p>{plugins.length} plugin manifesti Gateway API ve PostgreSQL Plugin Registry üzerinden geliyor.</p>
        </div>
        <button type="button" onClick={refreshPlugins}>
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

      <div className="plugin-filter-bar">
        <label>
          Plugin ara
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Plugin, kategori veya modül adı" />
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
        <span>
          {filteredPlugins.length} plugin filtrelendi, {plugins.length} kayıt var
        </span>
      </div>

      <div className="module-registry-layout">
        <div className="module-registry-list">
          {filteredPlugins.map((plugin) => (
            <article className="module-registry-card" data-enabled={plugin.isEnabled ? "true" : "false"} key={plugin.key}>
              <header>
                <div>
                  <h3>{plugin.name}</h3>
                  <p>{plugin.description}</p>
                </div>
                <span>{statusText(plugin)}</span>
              </header>
              <dl>
                <div>
                  <dt>Key</dt>
                  <dd>{plugin.key}</dd>
                </div>
                <div>
                  <dt>Kategori</dt>
                  <dd>{plugin.category}</dd>
                </div>
                <div>
                  <dt>Sağlayıcı</dt>
                  <dd>{plugin.provider}</dd>
                </div>
                <div>
                  <dt>Lisans</dt>
                  <dd>{plugin.licenseStatus}</dd>
                </div>
              </dl>
              <div className="module-badges">
                {plugin.isCore ? <span>Core manifest</span> : null}
                {plugin.requiredModules.length ? <span>Modül: {plugin.requiredModules.join(", ")}</span> : <span>Ek modül yok</span>}
                <span>{plugin.sourceType}</span>
              </div>
              <div className="module-registry-actions">
                <button disabled={busyKey === plugin.key || plugin.isEnabled} type="button" onClick={() => mutatePlugin(plugin.key, "activate")}>
                  Aktif Et
                </button>
                <button disabled={busyKey === plugin.key || !plugin.isEnabled} type="button" onClick={() => mutatePlugin(plugin.key, "deactivate")}>
                  Pasifleştir
                </button>
                <button type="button" onClick={() => loadEvents(plugin.key)}>
                  Olay Geçmişi
                </button>
              </div>
            </article>
          ))}
          {!filteredPlugins.length ? <div className="empty-state">Bu filtrelerle eşleşen plugin yok.</div> : null}
        </div>

        <aside className="module-registry-detail">
          <h2>{selectedPlugin?.name ?? "Plugin seçin"}</h2>
          {selectedPlugin ? (
            <>
              <p>{selectedPlugin.description}</p>
              <div className="theme-detail-stack">
                <strong>Gerekli modüller</strong>
                <span>{selectedPlugin.requiredModules.length ? selectedPlugin.requiredModules.join(", ") : "Yok"}</span>
                <strong>Yetkiler</strong>
                <span>{selectedPlugin.permissions.length ? selectedPlugin.permissions.join(", ") : "Yetki tanımı yok"}</span>
                <strong>Yetenekler</strong>
                <span>{capabilityText(selectedPlugin.capabilities)}</span>
              </div>
              <label>
                Ayar anahtarı
                <input value={settingKey} onChange={(event) => setSettingKey(event.target.value)} />
              </label>
              <label>
                Ayar değeri
                <input value={settingValue} onChange={(event) => setSettingValue(event.target.value)} />
              </label>
              <button disabled={busyKey === selectedPlugin.key} type="button" onClick={() => saveSettings(selectedPlugin.key)}>
                Ayarı Kaydet
              </button>
              <div className="module-event-list">
                <h3>Olay geçmişi</h3>
                {events.length ? (
                  <ol>
                    {events.map((event) => (
                      <li key={event.id}>
                        <strong>{event.event_type}</strong>
                        <span>{new Date(event.created_at).toLocaleString("tr-TR")}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>Bu plugin için event kaydı henüz yok.</p>
                )}
              </div>
            </>
          ) : (
            <p>Plugin Registry boş. Bootstrap çalışınca core plugin manifestleri burada görünür.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
