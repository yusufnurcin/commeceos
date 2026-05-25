"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const currencies = ["TRY", "USD", "EUR", "GBP"] as const;
const locales = ["tr-TR", "en-US", "de-DE", "fr-FR"] as const;
const timezones = ["Europe/Istanbul", "UTC", "Europe/Berlin", "America/New_York"] as const;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function NewTenantPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [tenantName, setTenantName] = useState("");
  const [slug, setSlug] = useState("");
  const [country, setCountry] = useState("TR");
  const [currency, setCurrency] = useState<(typeof currencies)[number]>("TRY");
  const [locale, setLocale] = useState<(typeof locales)[number]>("tr-TR");
  const [timezone, setTimezone] = useState<(typeof timezones)[number]>("Europe/Istanbul");
  const [erpMode, setErpMode] = useState("odoo-placeholder");
  const [commerceMode, setCommerceMode] = useState("medusa-placeholder");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewSlug = useMemo(() => slug || slugify(tenantName), [slug, tenantName]);
  const valid = tenantName.trim().length >= 2 && /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(previewSlug);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!valid) {
      setError("Tenant adı ve slug bilgilerini kontrol edin.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantName,
        slug: previewSlug,
        country,
        currency,
        locale,
        timezone,
        erpMode,
        commerceMode
      })
    });
    const payload = (await response.json().catch(() => ({}))) as { readonly tenant?: { readonly tenantId?: string }; readonly status?: string };
    setLoading(false);

    if (response.status === 401) {
      router.replace("/login");
      return;
    }

    if (response.status === 409) {
      setError("Bu slug ile kayıtlı tenant var.");
      return;
    }

    if (response.status === 422 || !response.ok) {
      setError(payload.status ?? "Tenant oluşturulamadı.");
      return;
    }

    setResult(payload.tenant?.tenantId ?? previewSlug);
    router.push(`/tenants/${encodeURIComponent(payload.tenant?.tenantId ?? previewSlug)}`);
  }

  return (
    <main className="form-shell">
      <nav className="breadcrumb">
        <Link href="/">Runtime</Link>
        <span>Tenant oluştur</span>
      </nav>
      <section className="form-stage">
        <div className="form-copy">
          <h1>İlk tenant provisioning</h1>
          <p>Registry, workspace, namespace, bridge placeholder ve outbox kaydı tek transaction içinde oluşturulur.</p>
          <div className="stepper">
            {[1, 2, 3].map((item) => (
              <button data-active={step === item} key={item} onClick={() => setStep(item)} type="button">
                {item}
              </button>
            ))}
          </div>
          <article className="preview-card">
            <span>{previewSlug || "slug"}</span>
            <strong>{tenantName || "Tenant adı"}</strong>
            <p>
              {country} · {currency} · {locale} · {timezone}
            </p>
            <small>
              {erpMode} / {commerceMode}
            </small>
          </article>
        </div>
        <form className="tenant-form" onSubmit={submit}>
          {step === 1 ? (
            <>
              <label>
                Tenant adı
                <input
                  value={tenantName}
                  onChange={(event) => {
                    setTenantName(event.target.value);
                    if (!slug) {
                      setSlug(slugify(event.target.value));
                    }
                  }}
                />
              </label>
              <label>
                Slug
                <input value={previewSlug} onChange={(event) => setSlug(slugify(event.target.value))} />
              </label>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <label>
                Ülke
                <input maxLength={2} value={country} onChange={(event) => setCountry(event.target.value.toUpperCase())} />
              </label>
              <label>
                Varsayılan para birimi
                <select value={currency} onChange={(event) => setCurrency(event.target.value as (typeof currencies)[number])}>
                  {currencies.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Dil
                <select value={locale} onChange={(event) => setLocale(event.target.value as (typeof locales)[number])}>
                  {locales.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Zaman dilimi
                <select value={timezone} onChange={(event) => setTimezone(event.target.value as (typeof timezones)[number])}>
                  {timezones.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <label>
                ERP modu
                <select value={erpMode} onChange={(event) => setErpMode(event.target.value)}>
                  <option value="odoo-placeholder">Odoo bridge placeholder</option>
                  <option value="odoo-ready">Odoo bridge ready</option>
                </select>
              </label>
              <label>
                Commerce modu
                <select value={commerceMode} onChange={(event) => setCommerceMode(event.target.value)}>
                  <option value="medusa-placeholder">Medusa bridge placeholder</option>
                  <option value="medusa-ready">Medusa bridge ready</option>
                </select>
              </label>
            </>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}
          {result ? <p className="form-success">{result} oluşturuldu.</p> : null}
          <div className="form-actions">
            <button disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))} type="button">
              Geri
            </button>
            {step < 3 ? (
              <button onClick={() => setStep((current) => Math.min(3, current + 1))} type="button">
                İleri
              </button>
            ) : (
              <button disabled={loading || !valid} type="submit">
                {loading ? "Provisioning" : "Tenant oluştur"}
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
