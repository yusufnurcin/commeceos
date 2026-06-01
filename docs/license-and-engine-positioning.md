# License and Engine Positioning Inventory

Bu belge teknik envanterdir; hukuki görüş veya kesin ticari kullanım garantisi değildir. Üretim yayını öncesinde lisans danışmanı veya avukat incelemesi gerekir.

## Engine Positioning

- **Commerce OS Core** kendi tenant, satıcı, katalog ve sipariş tablolarıyla ana sistemdir.
- **Medusa** zorunlu ana motor değildir. Opsiyonel commerce provider / bridge olarak catalog ve order sync job kuyruklarına bağlanır.
- **Odoo** opsiyonel ERP provider / bridge motorudur. Ham Odoo UI platform ürünü değildir. Container ve TCP health sinyali gerçektir; muhasebe, stok, fatura ve satın alma akışları auth adaptörü, kontrollü bridge, mapping ve worker katmanlarıyla açılmalıdır.
- **Integration Vault** dış servis credential kayıtlarını ve provider dayanıklılık politikalarını merkezileştirir.

## Ana Altyapılar

| Altyapı | Repo sürümü / image | Lisans | Ticari kullanım notu | Dikkat edilmesi gereken risk | Sistem içindeki konumu |
| --- | --- | --- | --- | --- | --- |
| Next.js | `15.5.18` | MIT | Framework ticari uygulamalarda kullanılabilir. | Hosting sağlayıcısı ve ek servis koşulları ayrıca incelenmeli. | Central Admin ve diğer Next.js uygulamaları |
| React | `19.2.6` | MIT | UI kütüphanesi ticari uygulamalarda kullanılabilir. | Bağımlılıkların kendi lisansları ayrıca geçerlidir. | Next.js UI runtime |
| Node.js | Docker Node runtime | MIT ağırlıklı, üçüncü taraf bileşenleri içerir | Runtime ticari dağıtımda kullanılabilir. | Dağıtılan runtime sürümünün notice dosyaları ayrıca kontrol edilmeli. | Gateway ve servis runtime |
| PostgreSQL | `postgres:16-alpine` | PostgreSQL License | Liberal açık kaynak lisansıdır. | Image içindeki Alpine paketleri ayrıca envanterlenmeli. | Ana veri katmanı |
| Redis | `redis:7.4-alpine` | RSALv2 veya SSPLv1 | Kullanım senaryosu seçilen lisans koşuluna göre incelenmelidir. | Redis 7.4 BSD değildir. SaaS ve managed-service modeli için hukuk incelemesi gerekir. | Cache, queue ve event bus altyapısı |
| Meilisearch | `getmeili/meilisearch:v1.13` | MIT | Arama motoru ticari üründe kullanılabilir. | Cloud hizmeti seçilirse hizmet sözleşmesi ayrıca incelenmeli. | Arama indexi |
| MinIO | `RELEASE.2025-04-22T22-12-26Z` | GNU AGPLv3 | Self-host kullanım mümkündür. | Ağ üzerinden sunulan değiştirilmiş dağıtım ve türev çalışma yükümlülükleri hukuk incelemesi ister. | Object storage |
| Odoo Community | `odoo:18.0` | LGPLv3 | Community motor opsiyonel ERP provider katmanında kullanılabilir. | Community ve Enterprise addon sınırı korunmalıdır. Container health, ERP mapping ve worker hazır anlamına gelmez. | Opsiyonel ERP provider / bridge |
| Odoo Enterprise addonları | Mount noktası mevcut, lisanslı addon doğrulanmadı | Odoo Enterprise Edition License | Geçerli abonelik ve doğru kullanıcı sayısı gerekir. | `account_accountant` Community kurulumunda görünmüyor. Enterprise addonlarını sahte kurulu göstermeyin. | İleri muhasebe fonksiyonları |
| Medusa | `2.12.2` | MIT | Opsiyonel provider olarak kullanılabilir. | Core tablolar Medusa'ya bağımlı tasarlanmamalı; sync worker ayrı doğrulanmalı. | Opsiyonel commerce bridge provider |
| Tailwind CSS | `3.4.x` | MIT | UI stillendirme katmanında kullanılabilir. | Eklenti paketleri ayrıca kontrol edilmeli. | UI stil katmanı |
| shadcn/ui | Repo içinde doğrudan scaffold görünmüyor | unknown / needs review | Kullanılıyor varsayılmadı. | Sonraki UI bileşeni eklemelerinde kaynak ve lisans notu tutulmalı. | Şu an doğrulanmış aktif bağımlılık değil |
| lucide-react | Doğrudan repo bağımlılığı görünmüyor | ISC | Eklenirse ticari ve kişisel kullanım için açık lisans beyanı vardır. | Feather türevi ikonlar için notice koşulları korunmalı. | Şu an doğrulanmış aktif bağımlılık değil |
| pnpm | `9.15.4` package manager | MIT | Geliştirme ve build zincirinde kullanılabilir. | Runtime ürünüyle karıştırılmamalı. | Monorepo paket yöneticisi |
| Turborepo | Repo `^2.3.3`, lock çözümü güncel | MIT | Build orkestrasyonunda kullanılabilir. | CI image sürümü sabitlenmeli. | Monorepo build katmanı |

## Odoo Community / Enterprise Ayrımı

Canlı veritabanı incelemesinde `account`, `crm`, `hr`, `l10n_tr`, `mrp`, `point_of_sale`, `purchase`, `sale_management`, `stock` ve `website_sale` modülleri `installed` durumunda görüldü. `account_accountant` kaydı görünmedi. Bu nedenle gelişmiş muhasebe fonksiyonları Enterprise addon doğrulaması yapılmadan hazır kabul edilmez.

## Otomatik Node Lisans Envanteri

Repo bağımlılıkları için aşağıdaki komut çalıştırıldı:

```powershell
pnpm licenses list --json
```

Çıktıda MIT, Apache-2.0, ISC, BSD varyantları, MPL-2.0, CC lisansları ve `Unknown` grubu görüldü. `Unknown` kayıtlar yayın öncesi paket bazında incelenmelidir. Lock dosyası değiştikçe bu komut CI içinde tekrar çalıştırılmalıdır.

## Resmi Kaynaklar

- [Next.js MIT license](https://github.com/vercel/next.js/blob/canary/license.md)
- [React MIT license](https://github.com/facebook/react)
- [PostgreSQL License](https://www.postgresql.org/about/licence/)
- [Redis license matrix](https://redis.io/legal/licenses/)
- [Meilisearch repository](https://github.com/meilisearch/meilisearch)
- [MinIO repository and AGPLv3 notice](https://github.com/minio/minio)
- [Odoo license documentation](https://www.odoo.com/documentation/17.0/legal/licenses.html)
- [Medusa MIT license notice](https://github.com/medusajs/medusa)
- [Tailwind CSS repository](https://github.com/tailwindlabs/tailwindcss)
- [Lucide license](https://github.com/lucide-icons/lucide/blob/main/LICENSE)
- [pnpm repository](https://github.com/pnpm/pnpm)
- [Turborepo repository](https://github.com/vercel/turborepo)
