# ADR 0001: Commerce Engine Positioning

## Status

Accepted

## Context

Commerce OS v2 artık kendi tenant, seller, catalog ve order tablolarına sahiptir. Medusa health ve kontrollü sync job kuyrukları vardır. Odoo dahili ERP motoru olarak çalışır. Sistemin ürünleşmesi için domain sahipliği açık olmalıdır.

## Decision

- Commerce OS Core ana sistemdir.
- Medusa zorunlu ana motor değildir; opsiyonel commerce provider / bridge olarak kalır.
- Odoo ERP, muhasebe, stok ve fatura için opsiyonel provider / bridge motoru olarak kalır.
- Integration Vault dış servis provider ve credential yönetimini merkezileştirir.
- Laravel'e şu anda geçiş yapılmaz. Domain core kendi DB ve API sözleşmeleriyle bağımsız tutulur.

## Consequences

- Catalog ve order CRUD akışları Medusa kapalıyken çalışmaya devam eder.
- Medusa kapalıysa yalnız sync queue kontrollü `503 medusa_unavailable` veya kısıtlı mod mesajı verir.
- Odoo raw UI son kullanıcı deneyimi değildir.
- Odoo container ve TCP health sinyali, auth adaptörü, mapping veya worker akışlarının hazır olduğu anlamına gelmez.
- ERP mapping, worker ve conflict resolver ayrı fazlarda bağlanmalıdır.
- Provider değişimleri Commerce OS Core domain tablolarını değiştirmez.

## Alternatives Considered

### Medusa as primary engine

Reddedildi. Provider kesintisi tüm Commerce OS katalog ve sipariş çekirdeğini durdurmamalıdır.

### Laravel full rewrite

Şimdilik reddedildi. Mevcut gerçek DB ve API sözleşmelerini taşımak risk ve süre ekler. Domain core bağımsız kaldığı için daha sonra kontrollü değerlendirme yapılabilir.

### Odoo-only commerce

Reddedildi. ERP motoru ile platform UX, marketplace yönetişimi ve domain kontrol katmanı birbirine kilitlenmemelidir.

### Commerce OS Core with optional providers

Seçildi. Domain kayıtları Commerce OS Core'da tutulur; Medusa ve diğer providerlar kontrollü bridge sözleşmeleriyle bağlanır.

## Migration Safety Notes

- Sync job payloadları snapshot taşır.
- Doğrudan provider yazımı worker doğrulanmadan başarılı gösterilmez.
- Idempotency anahtarları ve audit olayları korunur.
- Provider kapalıyken core mutation yolları açık kalır.
