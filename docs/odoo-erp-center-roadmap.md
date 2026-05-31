# Odoo ERP Center Roadmap

## Mevcut Gerçek Seviye

### Hazır

- Odoo container
- TCP health
- `commerce_os_odoo` veritabanı
- Ham Odoo UI izolasyonu
- Community modül kurulum sinyali

### Kısmen Hazır

- Gateway bridge sözleşmesi
- Integration Vault içindeki `odoo_accounting` provider manifesti
- Tenant ERP bridge kayıtları

### Eksik

- Odoo auth adaptörü
- Gateway üzerinden model registry doğrulaması
- Muhasebe mapping
- Fatura sync
- Vergi kuralı mapping
- Stok sync
- Satın alma sync
- Conflict resolver
- Worker
- Commerce OS içinde ERP önizleme UI

## Sonraki ERP Fazı Önerisi

1. Odoo auth credential alanlarını Integration Vault üzerinden bağla.
2. Read-only model ve installed-module probe adaptörü kur.
3. Tenant-company mapping tablosunu ve UI akışını bağla.
4. Muhasebe mapping sözleşmesini kur.
5. Invoice sync outbox ve worker ekle.
6. Stock ve purchase sync workerlarını idempotent job modeliyle ekle.
7. Conflict resolver ve audit görünürlüğünü aç.

## Enterprise Riski

`account_accountant` Odoo Enterprise addonlarına bağlıdır. Lisanslı addon mount edilmeden ve abonelik koşulları doğrulanmadan kurulmuş kabul edilmez.

