"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { CatalogModuleView } from "./catalog-products-panel";
import { catalogReadableError } from "./catalog-products-panel";

export interface CatalogCategoryView {
  readonly categoryKey: string;
  readonly parentKey?: string | null;
  readonly name: string;
  readonly description?: string | null;
  readonly status: string;
  readonly sortOrder: number;
  readonly seo?: unknown;
  readonly medusaCategoryId?: string | null;
}

async function readJson(response: Response) {
  return response.json().catch(() => ({ status: "response_unavailable" })) as Promise<Record<string, unknown>>;
}

export function CatalogCategoriesPanel({ initialCategories, module }: { readonly initialCategories: readonly CatalogCategoryView[]; readonly module?: CatalogModuleView | null | undefined }) {
  const [categories, setCategories] = useState(initialCategories);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filtered = useMemo(() => categories.filter((category) => [category.name, category.categoryKey, category.parentKey].join(" ").toLocaleLowerCase("tr-TR").includes(query.trim().toLocaleLowerCase("tr-TR"))), [categories, query]);

  async function refresh() {
    const response = await fetch("/api/catalog/categories", { cache: "no-store" });
    const payload = await readJson(response);
    if (response.ok) setCategories((payload.categories as CatalogCategoryView[] | undefined) ?? []);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setError(null); setMessage(null);
    const response = await fetch("/api/catalog/categories", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryKey: String(data.get("categoryKey") ?? ""), name: String(data.get("name") ?? ""), parentKey: String(data.get("parentKey") ?? ""), description: String(data.get("description") ?? ""), sortOrder: Number(data.get("sortOrder") ?? 0), medusaCategoryId: String(data.get("medusaCategoryId") ?? ""), seo: { title: String(data.get("seoTitle") ?? "") } })
    });
    const payload = await readJson(response);
    setBusy(false);
    if (!response.ok) { setError(catalogReadableError(payload, "Kategori oluşturulamadı. Anahtar benzersiz ve en az iki karakter olmalı.")); return; }
    form.reset(); setMessage("Kategori kaydı oluşturuldu."); await refresh();
  }

  return <div className="catalog-panel">
    {message ? <p className="form-success">{message}</p> : null}{error ? <p className="form-error">{error}</p> : null}
    <section className="catalog-toolbar"><label>Kategori ara<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ad, anahtar veya üst kategori" /></label></section>
    <div className="catalog-layout"><main className="catalog-main"><section className="catalog-section"><header><div><h2>Kategoriler</h2><p>{filtered.length} kategori gösteriliyor.</p></div></header><div className="catalog-card-list">
      {filtered.map((category) => <article className="catalog-record-card" key={category.categoryKey}><header><div><h3>{category.name}</h3><p>{category.categoryKey}</p></div><mark>{category.status === "active" ? "Aktif" : category.status}</mark></header><dl className="catalog-metadata"><div><dt>Üst kategori</dt><dd>{category.parentKey ?? "Ana kategori"}</dd></div><div><dt>Sıra</dt><dd>{category.sortOrder}</dd></div><div><dt>Medusa kategori</dt><dd>{category.medusaCategoryId ?? "Henüz eşleşmedi"}</dd></div></dl></article>)}
      {!filtered.length ? <p className="empty-state">Henüz kategori yok. İlk gerçek kategoriyi sağdaki formdan oluşturun.</p> : null}
    </div></section></main><aside className="catalog-detail"><section><h2>Yeni kategori</h2><p>Kategori ağacına gerçek bir kayıt ekler.</p><form className="catalog-form" onSubmit={create}>
      <label>Kategori anahtarı<input name="categoryKey" placeholder="elektronik" required /></label><label>Kategori adı<input name="name" required /></label><label>Üst kategori<select name="parentKey" defaultValue=""><option value="">Ana kategori</option>{categories.map((category) => <option key={category.categoryKey} value={category.categoryKey}>{category.name}</option>)}</select></label><label>Açıklama<textarea name="description" /></label><label>Sıra<input name="sortOrder" type="number" defaultValue="0" /></label><label>SEO başlığı<input name="seoTitle" /></label><label>Medusa kategori ID<input name="medusaCategoryId" /></label><button disabled={busy || module?.isEnabled !== true}>Kategoriyi kaydet</button>
    </form></section></aside></div>
  </div>;
}
