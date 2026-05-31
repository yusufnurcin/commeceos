"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";

interface CredentialSchemaField {
  readonly key: string;
  readonly label: string;
  readonly type: string;
  readonly required: boolean;
  readonly secret: boolean;
}

interface IntegrationCredentialView {
  readonly id: string;
  readonly providerKey?: string;
  readonly label: string;
  readonly scope: string;
  readonly maskedSummary: Record<string, string>;
  readonly status: string;
  readonly lastTestStatus?: string | null;
  readonly lastTestAt?: string | null;
}

interface IntegrationHealthView {
  readonly status: string;
  readonly message?: string;
  readonly lastCheckedAt?: string;
  readonly lastError?: string | null;
}

interface ResiliencePolicyView {
  readonly timeoutMs: number;
  readonly retryCount: number;
  readonly retryBackoffMs: number;
  readonly circuitBreakerEnabled: boolean;
  readonly failureThreshold: number;
  readonly cooldownSeconds: number;
  readonly fallbackProviderKey?: string | null;
  readonly queueOnFailure: boolean;
}

export interface IntegrationProviderView {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly status: string;
  readonly providerType: string;
  readonly isEnabled: boolean;
  readonly requiredPluginKey?: string | null;
  readonly requiredModuleKey?: string | null;
  readonly capabilities?: unknown;
  readonly credentialSchema?: {
    readonly fields?: readonly CredentialSchemaField[];
  };
  readonly credentials?: readonly IntegrationCredentialView[];
  readonly credentialCount?: number;
  readonly health?: IntegrationHealthView;
  readonly resiliencePolicy?: ResiliencePolicyView | null;
}

interface IntegrationEventView {
  readonly id: string;
  readonly event_type: string;
  readonly created_at: string;
}

async function readJson(response: Response) {
  return response.json().catch(() => ({ status: "response_unavailable" })) as Promise<Record<string, unknown>>;
}

function readableError(payload: Record<string, unknown>, fallback: string) {
  switch (payload.status) {
    case "integration_vault_secret_missing":
      return "Vault secret tanımlı değil. Credential kaydı güvenli biçimde saklanamadığı için işlem durduruldu.";
    case "integration_provider_not_found":
      return "Sağlayıcı bulunamadı.";
    case "integration_credential_invalid":
      return "Credential alanlarını kontrol edin. Zorunlu alanlar eksik veya geçersiz.";
    case "integration_credential_not_found":
      return "Credential kaydı bulunamadı.";
    case "integration_resilience_policy_invalid":
      return "Dayanıklılık politikasındaki değerleri kontrol edin.";
    case "integration_fallback_provider_invalid":
      return "Fallback sağlayıcısı geçerli değil.";
    case "auth_required":
      return "Bu alan için aktif oturum gerekli.";
    case "super_admin_required":
      return "Bu işlem için super admin yetkisi gerekli.";
    default:
      return fallback;
  }
}

function healthLabel(status?: string) {
  switch (status) {
    case "config_valid":
      return "Yapılandırma geçerli";
    case "adapter_not_configured":
      return "Adaptör bağlı değil";
    case "not_checked":
      return "Henüz test edilmedi";
    default:
      return status ?? "Durum bekleniyor";
  }
}

function capabilityText(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join(", ") : "Yetenek tanımı bekleniyor";
}

export function IntegrationVaultPanel({ initialProviders }: { readonly initialProviders: readonly IntegrationProviderView[] }) {
  const [providers, setProviders] = useState<readonly IntegrationProviderView[]>(initialProviders);
  const [selectedKey, setSelectedKey] = useState(initialProviders[0]?.key ?? "");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [events, setEvents] = useState<readonly IntegrationEventView[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const categories = useMemo(() => Array.from(new Set(providers.map((provider) => provider.category))).sort((a, b) => a.localeCompare(b, "tr")), [providers]);
  const filteredProviders = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return providers.filter((provider) => {
      const categoryMatches = category === "all" || provider.category === category;
      const queryMatches =
        !normalized ||
        [provider.name, provider.key, provider.description, provider.category, provider.requiredModuleKey, provider.requiredPluginKey]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(normalized);
      return categoryMatches && queryMatches;
    });
  }, [providers, query, category]);
  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.key === selectedKey) ?? providers[0],
    [providers, selectedKey]
  );
  const credentialFields = selectedProvider?.credentialSchema?.fields ?? [];

  async function refreshProviders(nextSelectedKey = selectedKey) {
    const response = await fetch("/api/integrations/providers", { cache: "no-store" });
    const payload = await readJson(response);
    if (!response.ok) {
      setError(readableError(payload, "Sağlayıcı listesi alınamadı."));
      return;
    }
    const nextProviders = (payload.providers as IntegrationProviderView[] | undefined) ?? [];
    setProviders(nextProviders);
    setSelectedKey(nextSelectedKey || nextProviders[0]?.key || "");
  }

  function startAction() {
    setBusy(true);
    setMessage(null);
    setError(null);
  }

  async function createCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProvider) {
      return;
    }

    startAction();
    const form = event.currentTarget;
    const data = new FormData(form);
    const credentials = Object.fromEntries(credentialFields.map((field) => [field.key, String(data.get(field.key) ?? "")]));
    const response = await fetch(`/api/integrations/providers/${encodeURIComponent(selectedProvider.key)}/credentials`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: String(data.get("label") ?? `${selectedProvider.name} credential`),
        scope: "platform",
        credentials
      })
    });
    const payload = await readJson(response);
    setBusy(false);
    if (!response.ok) {
      setError(readableError(payload, "Credential kaydedilemedi."));
      return;
    }

    form.reset();
    setMessage("Credential şifrelenerek kaydedildi. Secret değerler response içinde gösterilmez.");
    await refreshProviders(selectedProvider.key);
  }

  async function testCredential(id: string) {
    startAction();
    const response = await fetch(`/api/integrations/credentials/${encodeURIComponent(id)}/test`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const payload = await readJson(response);
    setBusy(false);
    if (!response.ok) {
      setError(readableError(payload, "Credential testi çalıştırılamadı."));
      return;
    }

    setMessage(
      payload.status === "adapter_not_configured"
        ? "Credential yapısı geçerli. Ağ adaptörü bu fazda bağlı değil; dış servis çağrısı yapılmadı."
        : "Credential yapılandırması kontrol edildi."
    );
    if (selectedProvider) {
      await refreshProviders(selectedProvider.key);
      await loadEvents(selectedProvider.key);
    }
  }

  async function deleteCredential(id: string) {
    if (!selectedProvider) {
      return;
    }

    startAction();
    const response = await fetch(`/api/integrations/credentials/${encodeURIComponent(id)}`, { method: "DELETE" });
    const payload = await readJson(response);
    setBusy(false);
    if (!response.ok) {
      setError(readableError(payload, "Credential silinemedi."));
      return;
    }

    setMessage("Credential kaydı silindi.");
    await refreshProviders(selectedProvider.key);
    await loadEvents(selectedProvider.key);
  }

  async function savePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProvider) {
      return;
    }

    startAction();
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/integrations/providers/${encodeURIComponent(selectedProvider.key)}/resilience-policy`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        timeoutMs: Number(data.get("timeoutMs")),
        retryCount: Number(data.get("retryCount")),
        retryBackoffMs: Number(data.get("retryBackoffMs")),
        failureThreshold: Number(data.get("failureThreshold")),
        cooldownSeconds: Number(data.get("cooldownSeconds")),
        fallbackProviderKey: String(data.get("fallbackProviderKey") ?? ""),
        circuitBreakerEnabled: data.get("circuitBreakerEnabled") === "on",
        queueOnFailure: data.get("queueOnFailure") === "on"
      })
    });
    const payload = await readJson(response);
    setBusy(false);
    if (!response.ok) {
      setError(readableError(payload, "Dayanıklılık politikası kaydedilemedi."));
      return;
    }

    setMessage("Dayanıklılık politikası kaydedildi.");
    await refreshProviders(selectedProvider.key);
    await loadEvents(selectedProvider.key);
  }

  async function loadEvents(key: string) {
    setSelectedKey(key);
    const response = await fetch(`/api/integrations/providers/${encodeURIComponent(key)}/events`, { cache: "no-store" });
    const payload = await readJson(response);
    if (!response.ok) {
      setError(readableError(payload, "Entegrasyon olayları alınamadı."));
      return;
    }
    setEvents((payload.events as IntegrationEventView[] | undefined) ?? []);
  }

  return (
    <section className="integration-vault-panel">
      <div className="integration-vault-callout">
        <strong>Sağlayıcı dayanıklılığı</strong>
        <span>Bir dış servis çalışmadığında yalnızca ilgili özellik kontrollü biçimde kısıtlanır. Secret değerler şifreli tutulur ve ekrana geri basılmaz.</span>
      </div>

      <div className="module-registry-toolbar">
        <div>
          <h2>Integration Vault</h2>
          <p>{providers.length} provider manifesti Gateway API ve PostgreSQL vault kayıtlarından geliyor.</p>
        </div>
        <button type="button" onClick={() => refreshProviders()}>
          Listeyi Yenile
        </button>
      </div>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="plugin-filter-bar">
        <label>
          Sağlayıcı ara
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SMTP, ödeme, kargo veya AI" />
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
          {filteredProviders.length} sağlayıcı filtrelendi, {providers.length} kayıt var
        </span>
      </div>

      <div className="integration-vault-layout">
        <div className="integration-provider-list">
          {filteredProviders.map((provider) => (
            <article className="integration-provider-card" data-selected={provider.key === selectedProvider?.key ? "true" : "false"} key={provider.key}>
              <header>
                <div>
                  <h3>{provider.name}</h3>
                  <p>{provider.description}</p>
                </div>
                <span>{healthLabel(provider.health?.status)}</span>
              </header>
              <dl>
                <div>
                  <dt>Kategori</dt>
                  <dd>{provider.category}</dd>
                </div>
                <div>
                  <dt>Credential</dt>
                  <dd>{provider.credentialCount ? `${provider.credentialCount} kayıt` : "Henüz yok"}</dd>
                </div>
              </dl>
              <small>Sağlayıcı durumu: {provider.isEnabled ? "Aktif" : "Pasif"}</small>
              <small>Modül: {provider.requiredModuleKey ?? "Bağımsız"} · Plugin: {provider.requiredPluginKey ?? "Bağımsız"}</small>
              <button type="button" onClick={() => loadEvents(provider.key)}>
                Yapılandır
              </button>
            </article>
          ))}
          {!filteredProviders.length ? <div className="empty-state">Bu filtrelerle eşleşen sağlayıcı yok.</div> : null}
        </div>

        <aside className="integration-provider-detail">
          {selectedProvider ? (
            <>
              <header>
                <div>
                  <h2>{selectedProvider.name}</h2>
                  <p>{selectedProvider.description}</p>
                  <small>Sağlayıcı durumu: {selectedProvider.isEnabled ? "Aktif" : "Pasif"}</small>
                </div>
                <mark>{healthLabel(selectedProvider.health?.status)}</mark>
              </header>

              <section>
                <h3>Credential kaydı</h3>
                <form className="integration-form" key={`credential-${selectedProvider.key}`} onSubmit={createCredential}>
                  <label>
                    Kayıt etiketi
                    <input name="label" placeholder={`${selectedProvider.name} credential`} required />
                  </label>
                  {credentialFields.map((field) => (
                    <label key={field.key}>
                      {field.label}
                      <input autoComplete="off" name={field.key} required={field.required} type={field.secret ? "password" : "text"} />
                    </label>
                  ))}
                  <button disabled={busy} type="submit">
                    Şifreleyerek Kaydet
                  </button>
                </form>
              </section>

              <section>
                <h3>Kayıtlı credential</h3>
                {selectedProvider.credentials?.length ? (
                  <div className="credential-list">
                    {selectedProvider.credentials.map((credential) => (
                      <article key={credential.id}>
                        <strong>{credential.label}</strong>
                        <span>{Object.entries(credential.maskedSummary).map(([key, value]) => `${key}: ${value}`).join(" · ")}</span>
                        <small>{healthLabel(credential.lastTestStatus ?? undefined)}</small>
                        <div>
                          <button disabled={busy} type="button" onClick={() => testCredential(credential.id)}>
                            Yapılandırmayı Test Et
                          </button>
                          <button disabled={busy} type="button" onClick={() => deleteCredential(credential.id)}>
                            Sil
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>Bu sağlayıcı için henüz credential kaydı yok.</p>
                )}
              </section>

              <section>
                <h3>Dayanıklılık politikası</h3>
                {selectedProvider.resiliencePolicy ? (
                  <form className="integration-policy-grid" key={`policy-${selectedProvider.key}`} onSubmit={savePolicy}>
                    <label>
                      Timeout (ms)
                      <input defaultValue={selectedProvider.resiliencePolicy.timeoutMs} name="timeoutMs" type="number" />
                    </label>
                    <label>
                      Retry sayısı
                      <input defaultValue={selectedProvider.resiliencePolicy.retryCount} name="retryCount" type="number" />
                    </label>
                    <label>
                      Retry bekleme (ms)
                      <input defaultValue={selectedProvider.resiliencePolicy.retryBackoffMs} name="retryBackoffMs" type="number" />
                    </label>
                    <label>
                      Hata eşiği
                      <input defaultValue={selectedProvider.resiliencePolicy.failureThreshold} name="failureThreshold" type="number" />
                    </label>
                    <label>
                      Cooldown (sn)
                      <input defaultValue={selectedProvider.resiliencePolicy.cooldownSeconds} name="cooldownSeconds" type="number" />
                    </label>
                    <label>
                      Fallback provider
                      <input defaultValue={selectedProvider.resiliencePolicy.fallbackProviderKey ?? ""} name="fallbackProviderKey" placeholder="Opsiyonel" />
                    </label>
                    <label className="integration-checkbox">
                      <input defaultChecked={selectedProvider.resiliencePolicy.circuitBreakerEnabled} name="circuitBreakerEnabled" type="checkbox" />
                      Circuit breaker aktif
                    </label>
                    <label className="integration-checkbox">
                      <input defaultChecked={selectedProvider.resiliencePolicy.queueOnFailure} name="queueOnFailure" type="checkbox" />
                      Hata halinde kuyruğa al
                    </label>
                    <button disabled={busy} type="submit">
                      Politikayı Kaydet
                    </button>
                  </form>
                ) : (
                  <p>Dayanıklılık politikası bekleniyor.</p>
                )}
              </section>

              <section>
                <h3>Bağlantı özeti</h3>
                <p>{selectedProvider.health?.message ?? "Ağ adaptörü bağlanana kadar testler yalnızca credential schema doğrulaması yapar."}</p>
                <small>Yetenekler: {capabilityText(selectedProvider.capabilities)}</small>
              </section>

              <section>
                <h3>Olay geçmişi</h3>
                {events.length ? (
                  <ol className="module-event-list">
                    {events.slice(0, 10).map((event) => (
                      <li key={event.id}>
                        <strong>{event.event_type}</strong>
                        <span>{new Date(event.created_at).toLocaleString("tr-TR")}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>Bu sağlayıcı için gösterilecek olay kaydı henüz yok.</p>
                )}
              </section>
            </>
          ) : (
            <p>Integration Vault provider manifesti bekleniyor.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
