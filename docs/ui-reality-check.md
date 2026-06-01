# UI Reality Check

## Arayüz neden boş görünüyordu?

Her faz sonunda QA kayıtları temizlendi. Bu doğru veri hijyeniydi; ancak dashboard gerçek registry ve domain sayaçlarını görünür kılmadığı için kullanıcı boş ekranı çalışmayan sistem olarak algılıyordu. Ayrıca bazı generic sayfalar teknik runtime dilini iş akışının önüne koyuyordu.

## QA verisi neden temizleniyor?

QA kayıtları üretim verisi değildir. Endpoint kanıtı için oluşturulur ve doğrulama bitince silinir. Böylece test siparişleri, satıcıları veya ürünleri gerçek operasyon kayıtlarına karışmaz.

## Demo Mode bunu nasıl çözüyor?

`DEMO_MODE_ENABLED=true` olduğunda `pnpm demo:seed` gerçek tenant, tema atama, seller/KYC, katalog ve sipariş tablolarına açıkça işaretlenmiş demo kayıtları yazar. İsimler `Demo` taşır; metadata içinde `demo=true` bulunur. `pnpm demo:cleanup` yalnız bu sınır içindeki kayıtları siler.

## Gerçek API'ye bağlı ekranlar

- Auth / session
- Tenant create, list, detail
- Module Registry
- Theme Registry ve tenant theme assignment
- Plugin Registry
- Integration Vault
- Seller onboarding ve KYC metadata
- Catalog product, category, variant ve sync job
- Order, item, return, refund ve sync job
- Demo Merkezi
- Odoo ERP gerçeklik görünümü

## Hala planlı veya generic ekranlar

- Finans, cüzdan, payout ve gerçek payment capture
- Kargo, kurye ve shipment label
- Destek ticket ve iletişim kanalları
- ERP accounting mapping, invoice sync, stock sync, purchase sync, conflict resolver ve worker
- Storefront rendering ve builder
- Medusa catalog/order push-pull worker

## Odoo neden çalışmıyor gibi görünüyordu?

Container sağlıklı olsa da Central Admin generic bir başlangıç sayfası gösteriyordu. Yeni ERP Merkezi health, iç URL, DB hedefi, auth adaptörü eksikliği, hazır/kısmi/eksik ayrımını gösterir. Kurulu Community modülleri canlı DB'de doğrulandı; `account_accountant` Enterprise riski ayrıca kaydedildi.

## Medusa neden yanlış algılanıyordu?

Metinler Medusa'yı ana commerce motoru gibi anlatıyordu. Commerce OS Core artık açıkça bağımsız domain sahibi olarak gösterilir. Medusa yalnız opsiyonel bridge provider ve sync job hedefidir.

## Central Admin ilk 5 UX önceliği

1. Registry ve domain sayaçlarını dashboard üzerinde canlı tutmak.
2. Empty state içinde yeni kayıt ve Demo Merkezi aksiyonlarını görünür göstermek.
3. Generic sayfaları gerçek endpoint geldikçe özel operasyon ekranlarına dönüştürmek.
4. Türkçe metin ve karakter doğrulamasını CI ve browser smoke testine eklemek.
5. Hazır, kısmen hazır ve eksik ayrımını engine ekranlarında korumak.

## Workspace OS deneyimine ne zaman geçilmeli?

macOS benzeri Workspace OS görsel fazına; finans, shipping, iletişim ve ERP mapping gibi temel iş akışlarının gerçek DB/API kontratları netleştikten sonra geçilmelidir. Önce davranış, sonra görsel sistem.

## PDF kapsamı arayüzde nasıl görünür tutuluyor?

`/blueprints` ekranı PDF içindeki `15 panel`, `211 menü grubu`, `1834 menü öğesi` ve `2910 permission` hedefini görünür tutar. Bu ekran 1834 öğeyi sidebar'a yığmaz. Normalize ana kapasiteleri panel, durum, provider ve permission alanlarına göre aranabilir kartlar halinde gösterir. Çalışmayan alanlar `Planlandı`, `Provider gerekli` veya `Entegrasyon gerekli` olarak etiketlenir.

## Mobil shell düzeltmesi

Central Admin sidebar mobil ve dar tablet görünümünde artık içeriğin üstüne uzun bir blok olarak yerleşmez. Üst bardaki menü butonu ile açılan drawer olarak çalışır. Bu davranış PDF kapsamı büyürken ana içeriğin okunabilir kalmasını sağlar.
