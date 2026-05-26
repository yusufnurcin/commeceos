"use client";

import { useMemo, useState } from "react";

export interface PlatformModuleView {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly status: string;
  readonly version: string;
  readonly installedVersion?: string | null;
  readonly isCore: boolean;
  readonly isEnabled: boolean;
  readonly requiresLicense: boolean;
  readonly licenseStatus: string;
  readonly dependencies: readonly string[];
  readonly capabilities?: unknown;
}

interface ModuleEventView {
  readonly id: string;
  readonly event_type: string;
  readonly actor_principal_id?: string | null;
  readonly created_at: string;
}

async function readJson(response: Response) {
  return response.json().catch(() => ({ status: "response_unavailable" })) as Promise<Record<string, unknown>>;
}

function statusText(module: PlatformModuleView) {
  if (module.isEnabled) {
    return "Aktif";
  }
  if (module.status === "blocked") {
    return "Engelli";
  }
  return "Pasif";
}

function errorMessage(payload: Record<string, unknown>, fallback: string) {
  switch (payload.status) {
    case "module_dependency_blocked":
      return "Bu modül için gerekli bağımlılıklar aktif değil.";
    case "core_module_disable_blocked":
      return "Çekirdek modül devre dışı bırakılamaz.";
    case "module_not_found":
      return "Modül bulunamadı.";
    case "module_settings_invalid":
      return "Ayarlar geçerli değil.";
    case "auth_required":
      return "Oturum gerekli.";
    case "super_admin_required":
      return "Bu işlem için super admin yetkisi gerekli.";
    case "runtime_store_unavailable":
      return "Kayıt servisine ulaşılamıyor.";
    default:
      return fallback;
  }
}

export function ModuleRegistryPanel({ initialModules }: { readonly initialModules: readonly PlatformModuleView[] }) {
  const [modules, setModules] = useState<readonly PlatformModuleView[]>(initialModules);
  const [selectedKey, setSelectedKey] = useState(initialModules[0]?.key ?? "");
  const [events, setEvents] = useState<readonly ModuleEventView[]>([]);
  const [settingKey, setSettingKey] = useState("enabledScope");
  const [settingValue, setSettingValue] = useState("platform");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedModule = useMemo(() => modules.find((module) => module.key === selectedKey) ?? modules[0], [modules, selectedKey]);

  async function refreshModules() {
    const response = await fetch("/api/modules", { cache: "no-store" });
    const payload = await readJson(response);
    if (!response.ok) {
      setError(errorMessage(payload, "Modül listesi alınamadı."));
      return;
    }
    setModules((payload.modules as PlatformModuleView[] | undefined) ?? []);
  }

  async function mutateModule(key: string, action: "enable" | "disable") {
    setBusyKey(key);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/modules/${encodeURIComponent(key)}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const payload = await readJson(response);
    setBusyKey(null);

    if (!response.ok) {
      setError(errorMessage(payload, "Modül işlemi başarısız oldu."));
      await loadEvents(key);
      return;
    }

    setMessage(action === "enable" ? "Modül etkinleştirildi." : "Modül devre dışı bırakıldı.");
    await refreshModules();
    await loadEvents(key);
  }

  async function saveSettings(key: string) {
    const normalizedKey = settingKey.trim();
    if (!normalizedKey) {
      setError("Ayar anahtarı gerekli.");
      return;
    }

    setBusyKey(key);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/modules/${encodeURIComponent(key)}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings: { [normalizedKey]: settingValue } })
    });
    const payload = await readJson(response);
    setBusyKey(null);

    if (!response.ok) {
      setError(errorMessage(payload, "Modül ayarı kaydedilemedi."));
      return;
    }

    setMessage("Modül ayarı kaydedildi.");
    await loadEvents(key);
  }

  async function loadEvents(key: string) {
    setSelectedKey(key);
    const response = await fetch(`/api/modules/${encodeURIComponent(key)}/events`, { cache: "no-store" });
    const payload = await readJson(response);
    if (!response.ok) {
      setError(errorMessage(payload, "Modül olay geçmişi alınamadı."));
      return;
    }
    setEvents((payload.events as ModuleEventView[] | undefined) ?? []);
  }

  return (
    <section className="module-registry-panel">
      <div className="module-registry-toolbar">
        <div>
          <h2>Module Registry</h2>
          <p>Bu liste Gateway API ve PostgreSQL module registry kayıtlarından gelir.</p>
        </div>
        <button type="button" onClick={refreshModules}>
          Listeyi Yenile
        </button>
      </div>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="module-registry-layout">
        <div className="module-registry-list">
          {modules.map((module) => (
            <article className="module-registry-card" data-enabled={module.isEnabled ? "true" : "false"} key={module.key}>
              <header>
                <div>
                  <h3>{module.name}</h3>
                  <p>{module.description}</p>
                </div>
                <span>{statusText(module)}</span>
              </header>
              <dl>
                <div>
                  <dt>Key</dt>
                  <dd>{module.key}</dd>
                </div>
                <div>
                  <dt>Kategori</dt>
                  <dd>{module.category}</dd>
                </div>
                <div>
                  <dt>Sürüm</dt>
                  <dd>{module.installedVersion ?? module.version}</dd>
                </div>
                <div>
                  <dt>Lisans</dt>
                  <dd>{module.licenseStatus}</dd>
                </div>
              </dl>
              <div className="module-badges">
                {module.isCore ? <span>Core module</span> : null}
                {module.dependencies.length ? <span>Bağımlılık: {module.dependencies.join(", ")}</span> : <span>Bağımlılık yok</span>}
              </div>
              <div className="module-registry-actions">
                <button disabled={busyKey === module.key || module.isEnabled} type="button" onClick={() => mutateModule(module.key, "enable")}>
                  Etkinleştir
                </button>
                <button disabled={busyKey === module.key || !module.isEnabled} type="button" onClick={() => mutateModule(module.key, "disable")}>
                  Devre dışı bırak
                </button>
                <button type="button" onClick={() => loadEvents(module.key)}>
                  Olay Geçmişi
                </button>
              </div>
            </article>
          ))}
        </div>

        <aside className="module-registry-detail">
          <h2>{selectedModule?.name ?? "Modül seçin"}</h2>
          {selectedModule ? (
            <>
              <p>{selectedModule.description}</p>
              <label>
                Ayar anahtarı
                <input value={settingKey} onChange={(event) => setSettingKey(event.target.value)} />
              </label>
              <label>
                Ayar değeri
                <input value={settingValue} onChange={(event) => setSettingValue(event.target.value)} />
              </label>
              <button disabled={busyKey === selectedModule.key} type="button" onClick={() => saveSettings(selectedModule.key)}>
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
                  <p>Bu modül için event kaydı henüz yok.</p>
                )}
              </div>
            </>
          ) : (
            <p>Module Registry boş. Bootstrap çalışınca core module kayıtları burada görünür.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
