# PDF Scope Reconciliation

Bu belge `ecommerce_saas_sistem_envanter_raporu_2026-05-21_150709(1).pdf` kaynak envanterinin Commerce OS v2 Node / Next / Medusa / Odoo monorepo içindeki karşılığını açıklar.

## Kaynak kapsam

PDF raporu 21 Mayıs 2026 tarihinde üretilmiştir. Kaynak hedefler:

| Alan | Hedef |
| --- | ---: |
| Panel | 15 |
| Menü grubu | 211 |
| Menü öğesi | 1834 |
| Permission | 2910 |
| Blueprint API endpoint kataloğu | 2910 |
| Blueprint veritabanı tablo tanımı | 70 |

Kaynak sayılar azaltılmamıştır. Runtime tarafında bütün menü öğelerini tek sidebar içine taşımak yerine normalize blueprint katmanı kullanılır.

## 15 operasyon paneli

| Panel | PDF kaynak adı | Amaç |
| --- | --- | --- |
| `central_admin` | `super_admin` | Platform sahibi ve süper admin kontrol merkezi |
| `admin` | `saas_admin` | Platform operasyon ekibi |
| `seller` | `seller` | Marketplace satıcı operasyonları |
| `customer` | `customer` | Marketplace müşteri hesabı |
| `courier` | `courier` | Global teslimat operasyonları |
| `tenant_admin` | `saas_user` | Tenant sahibi ve yönetim alanı |
| `tenant_customer` | `saas_customer` | Tenant müşteri alanı |
| `tenant_seller` | `saas_seller` | Tenant satıcı alanı |
| `tenant_courier` | `saas_courier` | Tenant kurye alanı |
| `finance` | `finance` | Finans, cüzdan, payout ve komisyon |
| `accounting` | `accounting` | Muhasebe, vergi, fatura ve ERP muhasebe |
| `ads` | `ads`, `saas_ads` | Reklam ve kampanya operasyonları |
| `design` | `design`, `saas_design` | Tema, storefront, builder ve medya |
| `support` | `super_admin:Destek/Ticket` | Destek ve iletişim ekip projeksiyonu |
| `developer_api` | `super_admin:API Yönetimi` | API, webhook, provider ve entegrasyon projeksiyonu |

PDF içindeki SaaS panel adları `metadata.sourceName` ve `metadata.sourceAliases` alanlarında korunur.

## Projedeki teknik karşılık

Merkezi manifest: `apps/central-admin/src/config/panel-blueprint.ts`

Blueprint katmanı şunları taşır:

- PDF kaynak metrikleri ve 15 kaynak panel satırı
- 15 operasyon panel projeksiyonu
- normalize ana kapasite kataloğu
- panel, rol, permission prefix, module binding ve provider kapsamı
- `runtime_ready`, `planned`, `provider_required`, `integration_required`, `enterprise_risk`, `license_review_required`, `disabled` durumları
- build sırasında çalışan kapsam ve duplicate key doğrulaması

Central Admin görünümü: `/blueprints`

Bu ekran:

- PDF hedef sayılarını gösterir
- 15 paneli okunabilir kartlarla listeler
- kapasite kataloğunu panel ve durum filtresiyle aratır
- provider bağlantı noktalarını ayrı gösterir
- kaynak PDF panel sayılarını görünür tutar

## Runtime-ready alanlar

- Auth ve session
- Tenant registry
- Module Registry
- Plugin Registry
- Theme Registry ve tenant theme assignment
- Integration Vault provider kataloğu
- Seller onboarding ve KYC metadata
- Catalog ürün, kategori ve varyant çekirdeği
- Order, item, return ve refund çekirdeği
- Audit görünürlüğü
- Demo Mode
- Gateway health matrix

## Planned alanlar

- Finans, cüzdan, payout ve komisyon iş akışları
- Shipping, kurye ve depo domain çekirdeği
- Destek ticket ve iletişim operasyonları
- Storefront rendering ve builder
- API key ve webhook yönetimi
- Import / export worker akışları
- Backup / restore worker akışları
- Workspace OS görev, drawer, mesajlaşma ve mini araç yüzeyleri

## Provider-required alanlar

- Medusa opsiyonel commerce sync provider
- Odoo opsiyonel ERP provider
- ERPNext ve Apache OFBiz alternatif ERP provider sözleşmeleri
- Ödeme, kargo, e-posta, SMS, WhatsApp, push, chat, voice ve storage provider bağlantıları

Provider kesintisi Commerce OS Core domain tablolarını düşürmez. Yalnız ilgili özellik kontrollü kısıtlı moda geçer.

## Odoo ve Medusa konumu

Medusa Commerce OS ana motoru değildir. Catalog ve order kayıtları Commerce OS Core tablolarındadır. Medusa yalnız kontrollü sync job hedefidir.

Odoo tamamlanmış ERP merkezi değildir. Container ve TCP health sinyali gerçektir; auth adaptörü, mapping, muhasebe, fatura, stok, satın alma, conflict resolver ve worker akışları ayrı gerçek domain fazlarında bağlanmalıdır.

## Sonraki gerçek domain faz sırası

1. Route preset ve mobil shell doğrulaması
2. Finans, cüzdan ve payout çekirdeği
3. Kargo, kurye ve shipment çekirdeği
4. Destek ticket ve iletişim provider akışları
5. Odoo auth adaptörü, mapping ve kontrollü sync worker
6. Storefront rendering ve builder
7. Workspace OS davranış katmanı
