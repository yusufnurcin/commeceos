export type ManagementTone = "ready" | "waiting" | "setup" | "planned" | "attention";

export interface ManagementLink {
  readonly label: string;
  readonly href: string;
  readonly description: string;
}

export interface ManagementFormField {
  readonly label: string;
  readonly placeholder: string;
  readonly type?: "text" | "email" | "number" | "select";
  readonly helper?: string;
}

export interface StarterForm {
  readonly title: string;
  readonly description: string;
  readonly fields: readonly ManagementFormField[];
  readonly note: string;
  readonly actionLabel: string;
}

export interface ManagementArea {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly statusLabel: string;
  readonly statusTone: ManagementTone;
  readonly primaryAction: ManagementLink;
  readonly secondaryActions: readonly ManagementLink[];
  readonly emptyState: string;
  readonly nextStep: string;
  readonly engineService?: string | undefined;
  readonly engineLabel?: string | undefined;
  readonly operations: readonly ManagementLink[];
  readonly starterForm?: StarterForm | undefined;
}

export const primarySidebarItems: readonly ManagementLink[] = [
  { label: "Ana Panel", href: "/", description: "Günlük yönetim özeti" },
  { label: "Tenantlar", href: "/tenants", description: "Kiracı ve workspace yönetimi" },
  { label: "Satıcılar", href: "/marketplace/sellers", description: "Başvuru, KYC ve komisyon" },
  { label: "Ürünler", href: "/catalog/products", description: "Katalog ve ürün onayı" },
  { label: "Siparişler", href: "/orders", description: "Sipariş, iade ve iptal" },
  { label: "Finans", href: "/finance/wallets", description: "Cüzdan, ödeme ve payout" },
  { label: "Muhasebe", href: "/accounting/tax", description: "Vergi, fatura ve Odoo muhasebe" },
  { label: "ERP / Odoo", href: "/erp/odoo", description: "Odoo merkezi" },
  { label: "Medusa", href: "/commerce/medusa", description: "Headless commerce merkezi" },
  { label: "Lojistik", href: "/logistics/couriers", description: "Kargo, kurye ve depo" },
  { label: "Destek", href: "/support/tickets", description: "Ticket ve iletişim kanalları" },
  { label: "Pazarlama", href: "/marketing/campaigns", description: "Reklam, kampanya ve kupon" },
  { label: "Tasarım", href: "/design/themes", description: "Tema ve storefront" },
  { label: "Modüller", href: "/modules", description: "Eklenti, lisans ve hook yönetimi" },
  { label: "Kullanıcılar", href: "/security/roles", description: "Rol ve yetki yönetimi" },
  { label: "Ayarlar", href: "/settings", description: "Sistem ayarları" }
];

export const quickActions: readonly ManagementLink[] = [
  { label: "Yeni Tenant Oluştur", href: "/tenants/new", description: "İlk gerçek tenant provisioning akışını başlat" },
  { label: "Satıcı Başvurularını İncele", href: "/marketplace/applications", description: "Bekleyen başvuru ve KYC akışlarını aç" },
  { label: "Ürünleri Yönet", href: "/catalog/products", description: "Ürün, kategori ve import hazırlıklarını yönet" },
  { label: "Siparişleri Gör", href: "/orders", description: "Tüm sipariş operasyon alanına git" },
  { label: "Ödemeleri Kontrol Et", href: "/finance/wallets", description: "Cüzdan ve payout akışını denetle" },
  { label: "Odoo Merkezi", href: "/erp/odoo", description: "ERP köprü durumunu ve mapping akışını aç" },
  { label: "Medusa Merkezi", href: "/commerce/medusa", description: "Commerce engine köprülerini yönet" },
  { label: "Modül Merkezi", href: "/modules", description: "Modül, eklenti ve lisans alanını aç" },
  { label: "Tema Yönetimi", href: "/design/themes", description: "Tema ve storefront başlangıcına git" },
  { label: "Sistem Ayarları", href: "/settings", description: "Dil, para birimi, iletişim ve API ayarları" }
];

export const managementAreas: readonly ManagementArea[] = [
  {
    id: "tenants",
    title: "Tenant Yönetimi",
    description: "Tenant yaşam döngüsü, domain, kullanıcı, fatura ve izolasyon alanlarını tek yerden yönetin.",
    href: "/tenants",
    statusLabel: "Kullanıma hazır",
    statusTone: "ready",
    primaryAction: { label: "Tenantları Aç", href: "/tenants", description: "Tenant listesini ve ilk kurulum adımlarını gör" },
    secondaryActions: [
      { label: "Yeni Tenant", href: "/tenants/new", description: "Provisioning formunu aç" },
      { label: "Domainler", href: "/tenant-control/domains", description: "Domain ve SSL hazırlığını gör" },
      { label: "Kullanıcılar", href: "/tenant-control/users", description: "Tenant kullanıcı alanını aç" }
    ],
    emptyState: "Henüz tenant yok. İlk tenant'ı oluştur.",
    nextStep: "İlk tenant oluşturulduktan sonra domain, kullanıcı, fatura ve modül kartları aktifleşir.",
    operations: [
      { label: "Tenant Listesi", href: "/tenants", description: "Gerçek tenant registry kayıtları" },
      { label: "Domain ve SSL", href: "/tenant-control/domains", description: "Alan adı, DNS ve sertifika hazırlığı" },
      { label: "Tenant Kullanıcıları", href: "/tenant-control/users", description: "Kiracı adminleri ve ekip erişimleri" },
      { label: "Tenant Yedekleri", href: "/tenant-control/backups", description: "Yedekleme ve geri yükleme hazırlığı" }
    ]
  },
  {
    id: "sellers",
    title: "Marketplace / Satıcılar",
    description: "Satıcı başvuruları, KYC belgeleri, komisyonlar, cüzdanlar ve ihlal süreçlerini yönetin.",
    href: "/marketplace/sellers",
    statusLabel: "Başvuru bekliyor",
    statusTone: "waiting",
    primaryAction: { label: "Satıcıları Yönet", href: "/marketplace/sellers", description: "Satıcı yönetim alanını aç" },
    secondaryActions: [
      { label: "Başvurular", href: "/marketplace/applications", description: "Satıcı başvuru kuyruğu" },
      { label: "KYC Belgeleri", href: "/marketplace/kyc", description: "Belge onayları" },
      { label: "Komisyonlar", href: "/marketplace/commissions", description: "Komisyon kuralları" }
    ],
    emptyState: "Henüz satıcı başvurusu yok. Başvuru formunu aktif et.",
    nextStep: "Satıcı başvuru kurallarını belirleyin; gerçek başvuru geldiğinde onay ve KYC akışı dolacak.",
    operations: [
      { label: "Satıcı Listesi", href: "/marketplace/sellers", description: "Global satıcı kayıtları" },
      { label: "Başvurular", href: "/marketplace/applications", description: "Onay bekleyen satıcılar" },
      { label: "KYC Belgeleri", href: "/marketplace/kyc", description: "Belge ve vergi levhası kontrolü" },
      { label: "Komisyonlar", href: "/marketplace/commissions", description: "Kategori ve satıcı bazlı komisyon" },
      { label: "Cüzdanlar", href: "/seller-ops/wallets", description: "Satıcı bakiyeleri ve blokajlar" },
      { label: "Performans", href: "/marketplace/seller-performance", description: "İhlal, puan ve kalite denetimi" },
      { label: "İhlaller", href: "/marketplace/stores", description: "Mağaza politika denetimi" }
    ],
    starterForm: {
      title: "Satıcı onay ayarları",
      description: "Başvuru, belge ve risk kontrolünün temel kuralını hazırlayın.",
      fields: [
        { label: "Varsayılan komisyon", placeholder: "%12", type: "text" },
        { label: "Zorunlu belge", placeholder: "Vergi levhası, kimlik, banka hesabı" },
        { label: "İlk onay modu", placeholder: "Manuel inceleme" }
      ],
      note: "Bu yapılandırma hazırlandı. Kaydetme işlemi marketplace modülü etkinleşince açılacak.",
      actionLabel: "Onay kuralını hazırla"
    }
  },
  {
    id: "catalog",
    title: "Ürün ve Katalog",
    description: "Ürünler, kategoriler, varyantlar, özellikler ve XML/CSV aktarım akışlarını yönetin.",
    href: "/catalog/products",
    statusLabel: "Medusa köprüsü bekliyor",
    statusTone: "setup",
    engineService: "medusa",
    engineLabel: "Medusa Catalog",
    primaryAction: { label: "Ürünleri Aç", href: "/catalog/products", description: "Katalog yönetim alanına git" },
    secondaryActions: [
      { label: "Kategoriler", href: "/catalog/categories", description: "Kategori ağacını yönet" },
      { label: "Varyantlar", href: "/catalog/variants", description: "Varyant hazırlığı" },
      { label: "XML / CSV", href: "/catalog/bulk-transfer", description: "Toplu import/export" }
    ],
    emptyState: "Henüz ürün yok. Medusa catalog bridge hazır.",
    nextStep: "Ürün import ayarını hazırlayın; Medusa catalog bridge aktif olduğunda ürün akışı başlayacak.",
    operations: [
      { label: "Ürünler", href: "/catalog/products", description: "Global ürün görünürlüğü ve moderasyon" },
      { label: "Onay Bekleyenler", href: "/catalog/comments", description: "Yorum, soru ve ürün moderasyonu" },
      { label: "Kategoriler", href: "/catalog/categories", description: "Kategori ve taksonomi" },
      { label: "Varyantlar", href: "/catalog/variants", description: "Renk, beden ve paket varyantları" },
      { label: "Özellikler", href: "/catalog/attributes", description: "Dinamik filtre ve attribute alanları" },
      { label: "XML / CSV", href: "/catalog/bulk-transfer", description: "Toplu aktarım ve hata raporu" }
    ],
    starterForm: {
      title: "Ürün import ayarları",
      description: "İlk katalog aktarımı için temel alanları hazırlayın.",
      fields: [
        { label: "Aktarım tipi", placeholder: "XML / CSV", type: "select" },
        { label: "Varsayılan kategori", placeholder: "Ana kategori seçilecek" },
        { label: "Fiyat alanı", placeholder: "price / sale_price" }
      ],
      note: "Bu yapılandırma hazırlandı. Kaydetme işlemi catalog modülü etkinleşince açılacak.",
      actionLabel: "Import ayarını hazırla"
    }
  },
  {
    id: "orders",
    title: "Sipariş Operasyonları",
    description: "Tüm siparişler, iadeler, iptaller, fraud şüpheli kayıtlar ve tenant/satıcı kırılımlarını yönetin.",
    href: "/orders",
    statusLabel: "Sipariş akışı bekliyor",
    statusTone: "waiting",
    engineService: "medusa",
    engineLabel: "Medusa Orders",
    primaryAction: { label: "Siparişleri Aç", href: "/orders", description: "Sipariş operasyon merkezine git" },
    secondaryActions: [
      { label: "İadeler", href: "/orders/returns", description: "İade ve değişim talepleri" },
      { label: "İptaller", href: "/orders/refunds", description: "Refund ve iptal akışı" },
      { label: "Fraud", href: "/orders/fraud", description: "Riskli siparişler" }
    ],
    emptyState: "Henüz sipariş akışı başlamadı. Medusa order bridge hazır olduğunda kayıtlar görünür.",
    nextStep: "Checkout ve order bridge ayarlarını tamamlayın; gerçek sipariş geldikçe listeler dolacak.",
    operations: [
      { label: "Tüm Siparişler", href: "/orders", description: "Tenant ve satıcı kapsamlı liste" },
      { label: "Yeni Siparişler", href: "/orders", description: "Yeni gelen sipariş görünürlüğü" },
      { label: "İadeler", href: "/orders/returns", description: "İade ve değişim" },
      { label: "İptaller", href: "/orders/refunds", description: "Refund ve iptal" },
      { label: "Fraud Şüpheli", href: "/orders/fraud", description: "Riskli sipariş denetimi" },
      { label: "Satıcı Bazlı", href: "/seller-ops/orders", description: "Satıcı kırılımı" },
      { label: "Tenant Bazlı", href: "/tenants", description: "Tenant kırılımı" }
    ]
  },
  {
    id: "finance",
    title: "Finans ve Cüzdan",
    description: "Global cüzdanlar, satıcı/tenant/kurye bakiyeleri, payout kuyruğu ve bloke bakiyeleri yönetin.",
    href: "/finance/wallets",
    statusLabel: "Ödeme sağlayıcısı bekliyor",
    statusTone: "setup",
    primaryAction: { label: "Finansı Aç", href: "/finance/wallets", description: "Cüzdan ve ödeme alanına git" },
    secondaryActions: [
      { label: "Ödemeler", href: "/finance/payments", description: "Ödeme akışı" },
      { label: "Sağlayıcılar", href: "/finance/providers", description: "Ödeme sağlayıcıları" },
      { label: "Payout", href: "/finance/payouts", description: "Çekim kuyruğu" }
    ],
    emptyState: "Henüz ödeme akışı yok. Ödeme sağlayıcılarını yapılandır.",
    nextStep: "Ödeme sağlayıcı seçimini hazırlayın; finans modülü etkinleşince cüzdan ve payout akışı açılacak.",
    operations: [
      { label: "Global Cüzdanlar", href: "/finance/wallets", description: "Tüm cüzdan denetimi" },
      { label: "Satıcı Bakiyeleri", href: "/seller-ops/wallets", description: "Satıcı bakiye ve blokaj" },
      { label: "Tenant Bakiyeleri", href: "/tenants", description: "Tenant finans kırılımı" },
      { label: "Kurye Bakiyeleri", href: "/logistics/couriers", description: "Kurye ödeme hazırlığı" },
      { label: "Payout Kuyruğu", href: "/finance/payouts", description: "Çekim talepleri" },
      { label: "Bloke Bakiyeler", href: "/finance/chargebacks", description: "Chargeback ve dispute riski" }
    ],
    starterForm: {
      title: "Ödeme sağlayıcı başlangıcı",
      description: "İlk ödeme entegrasyonu için temel bilgileri hazırlayın.",
      fields: [
        { label: "Sağlayıcı", placeholder: "Stripe, Iyzico, PayTR veya banka", type: "select" },
        { label: "Varsayılan para birimi", placeholder: "TRY" },
        { label: "Payout periyodu", placeholder: "Haftalık / Aylık" }
      ],
      note: "Bu yapılandırma hazırlandı. Kaydetme işlemi ödeme modülü etkinleşince açılacak.",
      actionLabel: "Ödeme ayarını hazırla"
    }
  },
  {
    id: "accounting",
    title: "Muhasebe ve Vergi",
    description: "Ülke bazlı vergiler, KDV/VAT/GST, fatura merkezi ve Odoo muhasebe bağlantısını yönetin.",
    href: "/accounting/tax",
    statusLabel: "Odoo muhasebe bekliyor",
    statusTone: "setup",
    engineService: "odoo",
    engineLabel: "Odoo Muhasebe",
    primaryAction: { label: "Vergileri Aç", href: "/accounting/tax", description: "Muhasebe ve vergi alanına git" },
    secondaryActions: [
      { label: "Faturalar", href: "/accounting/invoices", description: "Fatura merkezi" },
      { label: "Cari Hesaplar", href: "/accounting/accounts", description: "Cari hesaplar" },
      { label: "Raporlar", href: "/accounting/reports", description: "Muhasebe raporları" }
    ],
    emptyState: "Henüz vergi kuralı yok. Odoo muhasebe bağlantısı hazır olduğunda kayıtlar görünür.",
    nextStep: "İlk vergi kuralını hazırlayın; Odoo muhasebe mapping tamamlanınca fatura akışı açılır.",
    operations: [
      { label: "Ülke Bazlı Vergiler", href: "/localization/tax-regimes", description: "Bölgesel vergi rejimleri" },
      { label: "KDV / VAT / GST", href: "/accounting/tax", description: "Temel vergi oranları" },
      { label: "Fatura Merkezi", href: "/accounting/invoices", description: "E-fatura ve komisyon faturaları" },
      { label: "Odoo Muhasebe", href: "/erp/accounting", description: "ERP muhasebe bağlantısı" },
      { label: "Vergi Raporları", href: "/accounting/reports", description: "Vergi ve finansal raporlar" }
    ],
    starterForm: {
      title: "Vergi kuralı başlangıcı",
      description: "İlk ülke ve oran kuralını hazırlayın.",
      fields: [
        { label: "Ülke", placeholder: "Türkiye", type: "select" },
        { label: "Vergi tipi", placeholder: "KDV / VAT / GST" },
        { label: "Varsayılan oran", placeholder: "%20" }
      ],
      note: "Bu yapılandırma hazırlandı. Kaydetme işlemi muhasebe modülü etkinleşince açılacak.",
      actionLabel: "Vergi kuralını hazırla"
    }
  },
  {
    id: "odoo",
    title: "ERP / Odoo",
    description: "Odoo health, modüller, muhasebe, stok, depo, satın alma, CRM, HR, mapping ve sync işlerini yönetin.",
    href: "/erp/odoo",
    statusLabel: "Odoo hazır",
    statusTone: "ready",
    engineService: "odoo",
    engineLabel: "Odoo ERP",
    primaryAction: { label: "Odoo Merkezi", href: "/erp/odoo", description: "ERP yönetim merkezini aç" },
    secondaryActions: [
      { label: "Mapping Studio", href: "/erp/mapping-studio", description: "Alan eşleştirme" },
      { label: "Sync Jobs", href: "/erp/sync-jobs", description: "Senkronizasyon işleri" },
      { label: "Çakışmalar", href: "/erp/conflicts", description: "Veri çakışmaları" }
    ],
    emptyState: "Odoo bağlantısı hazır. Muhasebe ve stok mapping adımları bekliyor.",
    nextStep: "Önce şirket ve muhasebe mapping hazırlığını tamamlayın, sonra sync işlerini açın.",
    operations: [
      { label: "Odoo Health", href: "/erp/odoo", description: "Servis durumu" },
      { label: "Modüller", href: "/erp/modules", description: "Odoo modül kataloğu" },
      { label: "Muhasebe", href: "/erp/accounting", description: "Fatura ve vergi mapping" },
      { label: "Stok", href: "/erp/inventory", description: "Stok ve ürün mapping" },
      { label: "Depo", href: "/logistics/warehouses", description: "Depo ve transfer" },
      { label: "Satın Alma", href: "/erp/inventory", description: "Tedarik ve satın alma hazırlığı" },
      { label: "CRM", href: "/erp/crm-hr-pos", description: "CRM modülleri" },
      { label: "HR", href: "/erp/crm-hr-pos", description: "Personel modülleri" },
      { label: "Mapping Studio", href: "/erp/mapping-studio", description: "Alan eşleştirme" },
      { label: "Sync Jobs", href: "/erp/sync-jobs", description: "Senkronizasyon işleri" },
      { label: "Çakışma Çözümleyici", href: "/erp/conflicts", description: "Veri çakışmaları" }
    ],
    starterForm: {
      title: "Odoo mapping başlangıcı",
      description: "İlk şirket ve muhasebe eşlemesini hazırlayın.",
      fields: [
        { label: "Odoo şirketi", placeholder: "Ana şirket" },
        { label: "Tenant eşlemesi", placeholder: "central / tenant seçimi" },
        { label: "İlk sync alanı", placeholder: "Muhasebe, stok veya ürün" }
      ],
      note: "Bu yapılandırma hazırlandı. Kaydetme işlemi Odoo modülü etkinleşince açılacak.",
      actionLabel: "Mapping hazırlığını yap"
    }
  },
  {
    id: "medusa",
    title: "Medusa Commerce",
    description: "Catalog, pricing, cart, checkout, order, tax, inventory ve sync köprülerini yönetin.",
    href: "/commerce/medusa",
    statusLabel: "Medusa hazır",
    statusTone: "ready",
    engineService: "medusa",
    engineLabel: "Medusa Commerce",
    primaryAction: { label: "Medusa Merkezi", href: "/commerce/medusa", description: "Commerce engine yönetimini aç" },
    secondaryActions: [
      { label: "Catalog Bridge", href: "/commerce/catalog-bridge", description: "Ürün köprüsü" },
      { label: "Checkout Bridge", href: "/commerce/cart-checkout", description: "Sepet ve checkout" },
      { label: "Sync Jobs", href: "/commerce/sync-jobs", description: "Senkronizasyon işleri" }
    ],
    emptyState: "Medusa API hazır. Catalog ve order bridge ayarları bekliyor.",
    nextStep: "Önce catalog bridge ayarını hazırlayın, sonra pricing ve checkout akışlarını bağlayın.",
    operations: [
      { label: "Medusa Health", href: "/commerce/medusa", description: "Servis durumu" },
      { label: "Catalog Bridge", href: "/commerce/catalog-bridge", description: "Ürün ve katalog sync" },
      { label: "Pricing Bridge", href: "/commerce/pricing-bridge", description: "Fiyat ve bölge sync" },
      { label: "Cart Bridge", href: "/commerce/cart-checkout", description: "Sepet akışı" },
      { label: "Checkout Bridge", href: "/commerce/cart-checkout", description: "Checkout gate" },
      { label: "Order Bridge", href: "/commerce/order-return", description: "Sipariş ve iade" },
      { label: "Tax Bridge", href: "/commerce/promotion-region-tax", description: "Tax ve region" },
      { label: "Inventory Bridge", href: "/commerce/inventory-bridge", description: "Stok mapping" },
      { label: "Sync Jobs", href: "/commerce/sync-jobs", description: "Senkronizasyon işleri" }
    ],
    starterForm: {
      title: "Medusa bridge ayarı",
      description: "İlk commerce köprüsünü seçin ve hazırlayın.",
      fields: [
        { label: "İlk köprü", placeholder: "Catalog / Pricing / Checkout", type: "select" },
        { label: "Varsayılan bölge", placeholder: "TR" },
        { label: "Sync modu", placeholder: "Manuel onaylı" }
      ],
      note: "Bu yapılandırma hazırlandı. Kaydetme işlemi Medusa modülü etkinleşince açılacak.",
      actionLabel: "Bridge ayarını hazırla"
    }
  },
  {
    id: "logistics",
    title: "Lojistik ve Kuryeler",
    description: "Kuryeler, gönderiler, kargo firmaları, depolar, rotalar ve iade kargo kurallarını yönetin.",
    href: "/logistics/couriers",
    statusLabel: "Operasyon bekliyor",
    statusTone: "planned",
    primaryAction: { label: "Lojistiği Aç", href: "/logistics/couriers", description: "Kurye ve kargo alanına git" },
    secondaryActions: [
      { label: "Gönderiler", href: "/logistics/shipments", description: "Shipment akışı" },
      { label: "Depolar", href: "/logistics/warehouses", description: "Depo mapping" },
      { label: "Kargo Firmaları", href: "/logistics/carriers", description: "Carrier entegrasyonları" }
    ],
    emptyState: "Henüz kurye veya gönderi akışı yok. Kargo ve kurye kurallarını hazırlayın.",
    nextStep: "Kargo firması ve kurye onay kuralları hazırlanmalı.",
    operations: [
      { label: "Kuryeler", href: "/logistics/couriers", description: "Kurye başvuruları ve belgeleri" },
      { label: "Gönderiler", href: "/logistics/shipments", description: "Teslimat süreci" },
      { label: "Kargo Firmaları", href: "/logistics/carriers", description: "Carrier bağlantıları" },
      { label: "Depolar", href: "/logistics/warehouses", description: "Depo ve transfer" },
      { label: "Rotalar", href: "/logistics/routes", description: "Kurye rota hazırlığı" },
      { label: "İade Kargo", href: "/logistics/returns", description: "İade kargo kuralları" }
    ]
  },
  {
    id: "support",
    title: "Destek Merkezi",
    description: "Ticket, chatbot, WhatsApp, SMS, e-posta ve push kanallarını yönetin.",
    href: "/support/tickets",
    statusLabel: "Entegrasyon bekliyor",
    statusTone: "setup",
    primaryAction: { label: "Destek Talepleri", href: "/support/tickets", description: "Destek merkezini aç" },
    secondaryActions: [
      { label: "WhatsApp", href: "/support/whatsapp", description: "WhatsApp destek" },
      { label: "SMS", href: "/support/sms", description: "SMS sağlayıcı" },
      { label: "E-posta", href: "/support/email", description: "SMTP ve transactional mail" }
    ],
    emptyState: "Henüz destek talebi yok. İletişim kanallarını hazırlayın.",
    nextStep: "İlk destek kanalı ve bildirim şablonları bağlanmalı.",
    operations: [
      { label: "Ticketlar", href: "/support/tickets", description: "Destek talepleri" },
      { label: "Chatbot", href: "/support/chatbot", description: "AI destek asistanı" },
      { label: "WhatsApp", href: "/support/whatsapp", description: "Mesajlaşma kanalı" },
      { label: "SMS", href: "/support/sms", description: "SMS doğrulama ve duyuru" },
      { label: "E-posta", href: "/support/email", description: "Mail şablonları" },
      { label: "Push", href: "/support/push", description: "Uygulama bildirimleri" }
    ]
  },
  {
    id: "marketing",
    title: "Pazarlama ve Reklam",
    description: "Reklam, kampanya, kupon, flash sale, loyalty, affiliate ve story akışlarını yönetin.",
    href: "/marketing/campaigns",
    statusLabel: "Plan hazır",
    statusTone: "planned",
    primaryAction: { label: "Kampanyaları Aç", href: "/marketing/campaigns", description: "Pazarlama merkezini aç" },
    secondaryActions: [
      { label: "Reklamlar", href: "/marketing/ads", description: "Reklam alanları" },
      { label: "Kuponlar", href: "/marketing/coupons", description: "Kupon kuralları" },
      { label: "Loyalty", href: "/marketing/loyalty", description: "Puan ve seviye" }
    ],
    emptyState: "Henüz kampanya yok. İlk kampanya kuralını hazırlayın.",
    nextStep: "Kupon, kampanya ve reklam kuralları gerçek ürün/satıcı akışı geldiğinde aktifleşir.",
    operations: [
      { label: "Kampanyalar", href: "/marketing/campaigns", description: "Kampanya yönetimi" },
      { label: "Reklamlar", href: "/marketing/ads", description: "Sponsorlu alanlar" },
      { label: "Kuponlar", href: "/marketing/coupons", description: "Kupon kuralları" },
      { label: "Flash Sale", href: "/marketing/flash-sales", description: "Zamanlı indirimler" },
      { label: "Sadakat", href: "/marketing/loyalty", description: "Puan ve seviye" },
      { label: "Affiliate", href: "/marketing/affiliate", description: "Referans programı" }
    ]
  },
  {
    id: "design",
    title: "Tema ve Storefront",
    description: "Tema seçimi, storefront builder, kanal deneyimi, medya ve tema modüllerini yönetin.",
    href: "/design/themes",
    statusLabel: "Tema seçimi bekliyor",
    statusTone: "planned",
    primaryAction: { label: "Tema Yönetimi", href: "/design/themes", description: "Tema ve storefront alanını aç" },
    secondaryActions: [
      { label: "Builder", href: "/design/builder", description: "Storefront builder" },
      { label: "Medya", href: "/design/media", description: "Medya kütüphanesi" },
      { label: "Kanallar", href: "/design/channels", description: "Kanal deneyimi" }
    ],
    emptyState: "Henüz tema seçilmedi. Storefront için başlangıç ekranını hazırlayın.",
    nextStep: "İlk tema seçimini ve storefront kanalını belirleyin.",
    operations: [
      { label: "Temalar", href: "/design/themes", description: "Tema marketi ve aktif tema" },
      { label: "Storefront Builder", href: "/design/builder", description: "Sayfa ve blok düzeni" },
      { label: "Kanal Deneyimi", href: "/design/channels", description: "Tenant ve storefront kanalları" },
      { label: "Medya", href: "/design/media", description: "Görsel ve banner varlıkları" },
      { label: "Tema Modülleri", href: "/design/theme-modules", description: "Widget ve tema eklentileri" }
    ],
    starterForm: {
      title: "Tema seçme başlangıcı",
      description: "İlk storefront görünümü için temel tercihi hazırlayın.",
      fields: [
        { label: "Tema tipi", placeholder: "Marketplace / SaaS / B2B", type: "select" },
        { label: "Ana renk", placeholder: "Marka rengi" },
        { label: "Varsayılan dil", placeholder: "tr-TR" }
      ],
      note: "Bu yapılandırma hazırlandı. Kaydetme işlemi tasarım modülü etkinleşince açılacak.",
      actionLabel: "Tema hazırlığını yap"
    }
  },
  {
    id: "modules",
    title: "Modül ve Eklentiler",
    description: "Aktif/pasif modüller, modül yükleme, Odoo modülleri, lisanslar, bağımlılıklar ve hook/event yönetimini yönetin.",
    href: "/modules",
    statusLabel: "Modül registry bekliyor",
    statusTone: "setup",
    primaryAction: { label: "Modül Merkezini Aç", href: "/modules", description: "Modül ve eklenti alanına git" },
    secondaryActions: [
      { label: "Modül Marketi", href: "/modules/marketplace", description: "Eklenti marketi" },
      { label: "Lisanslar", href: "/modules/licenses", description: "Modül lisansları" },
      { label: "Hook / Event", href: "/modules/hooks-events", description: "Event yönetimi" }
    ],
    emptyState: "Henüz modül registry kaydı yok. Modül yükleme hazırlığını yapın.",
    nextStep: "Modül yükleme kuralını ve lisans bağlantısını hazırlayın.",
    operations: [
      { label: "Aktif Modüller", href: "/modules", description: "Etkin modül görünümü" },
      { label: "Pasif Modüller", href: "/modules", description: "Devre dışı modüller" },
      { label: "Modül Yükle", href: "/modules/marketplace", description: "Yeni modül kurulumu" },
      { label: "Odoo Modülleri", href: "/modules/odoo-integrations", description: "Odoo entegrasyonları" },
      { label: "Eklenti Marketi", href: "/modules/marketplace", description: "Market ve paketler" },
      { label: "Lisanslar", href: "/modules/licenses", description: "Lisans ve plan bağlantısı" },
      { label: "Bağımlılıklar", href: "/modules/licenses", description: "Dependency kontrolü" },
      { label: "Hook/Event Yönetimi", href: "/modules/hooks-events", description: "Event ve hook bağlantıları" }
    ],
    starterForm: {
      title: "Modül yükleme başlangıcı",
      description: "İlk modül kurulumu için temel bilgiyi hazırlayın.",
      fields: [
        { label: "Modül adı", placeholder: "Örn. gelişmiş kampanya" },
        { label: "Kaynak", placeholder: "Market / özel paket / Odoo" },
        { label: "Lisans tipi", placeholder: "Platform / tenant / satıcı" }
      ],
      note: "Bu yapılandırma hazırlandı. Kaydetme işlemi modül merkezi etkinleşince açılacak.",
      actionLabel: "Modül hazırlığını yap"
    }
  },
  {
    id: "users",
    title: "Kullanıcı ve Yetki",
    description: "Rol, yetki, oturum, KYC, fraud ve uyum süreçlerini yönetin.",
    href: "/security/roles",
    statusLabel: "Yetki altyapısı hazır",
    statusTone: "ready",
    primaryAction: { label: "Rolleri Aç", href: "/security/roles", description: "Rol ve yetki alanına git" },
    secondaryActions: [
      { label: "Yetkiler", href: "/security/permissions", description: "Yetki şablonları" },
      { label: "Oturumlar", href: "/security/sessions", description: "Aktif oturumlar" },
      { label: "KYC", href: "/security/kyc", description: "Belge kontrolü" }
    ],
    emptyState: "Super admin hazır. Yeni rol ve yetki şablonları sonraki ekipler için hazırlanabilir.",
    nextStep: "İlk operasyon ekibinin rol şablonunu belirleyin.",
    operations: [
      { label: "Roller", href: "/security/roles", description: "Rol ve rol grupları" },
      { label: "Yetkiler", href: "/security/permissions", description: "Yetki şablonları" },
      { label: "Oturumlar", href: "/security/sessions", description: "Cihaz ve oturum yönetimi" },
      { label: "KYC", href: "/security/kyc", description: "Belge denetimi" },
      { label: "Fraud", href: "/security/fraud", description: "Risk kuralları" },
      { label: "Uyum", href: "/security/compliance", description: "KVKK/GDPR hazırlığı" }
    ]
  },
  {
    id: "settings",
    title: "Sistem Ayarları",
    description: "Platform adı, logo, dil, para birimi, ülkeler, vergi, e-posta, SMS, WhatsApp, API/Webhook ve feature flag ayarlarını yönetin.",
    href: "/settings",
    statusLabel: "Ayar merkezi hazır",
    statusTone: "ready",
    primaryAction: { label: "Ayarları Aç", href: "/settings", description: "Sistem ayarları alanına git" },
    secondaryActions: [
      { label: "Ülkeler", href: "/localization/countries", description: "Ülke ayarları" },
      { label: "Integration Vault", href: "/settings/integrations", description: "Şifreli credential ve sağlayıcı dayanıklılığı" },
      { label: "API Anahtarları", href: "/integrations/api-keys", description: "API erişimleri" },
      { label: "Webhooklar", href: "/integrations/webhooks", description: "Webhook ayarları" }
    ],
    emptyState: "Sistem ayarları hazır. Platform kimliği ve iletişim kanallarını belirleyin.",
    nextStep: "Önce platform adı, varsayılan dil, para birimi ve iletişim sağlayıcılarını hazırlayın.",
    operations: [
      { label: "Integration Vault", href: "/settings/integrations", description: "Dış servis credential ve dayanıklılık politikaları" },
      { label: "Platform adı/logo", href: "/settings", description: "Marka kimliği" },
      { label: "Dil", href: "/localization/languages", description: "Varsayılan dil" },
      { label: "Para birimi", href: "/localization/currencies", description: "Varsayılan para birimi" },
      { label: "Ülkeler", href: "/localization/countries", description: "Aktif ülkeler" },
      { label: "Vergi", href: "/accounting/tax", description: "Vergi rejimleri" },
      { label: "E-posta", href: "/support/email", description: "SMTP ve transactional mail" },
      { label: "SMS", href: "/support/sms", description: "SMS sağlayıcı" },
      { label: "WhatsApp", href: "/support/whatsapp", description: "WhatsApp sağlayıcı" },
      { label: "API / Webhook", href: "/integrations/api-keys", description: "API ve webhook erişimleri" },
      { label: "Feature flags", href: "/settings", description: "Modül aç/kapat hazırlığı" }
    ],
    starterForm: {
      title: "Platform ayarı başlangıcı",
      description: "Marka ve varsayılan yerelleştirme değerlerini hazırlayın.",
      fields: [
        { label: "Platform adı", placeholder: "Commerce OS" },
        { label: "Varsayılan dil", placeholder: "Türkçe" },
        { label: "Varsayılan para birimi", placeholder: "TRY" }
      ],
      note: "Bu yapılandırma hazırlandı. Kaydetme işlemi sistem ayarları modülü etkinleşince açılacak.",
      actionLabel: "Ayar hazırlığını yap"
    }
  }
];

export const searchableManagementLinks: readonly ManagementLink[] = [
  ...primarySidebarItems,
  ...quickActions,
  ...managementAreas.flatMap((area) => [area.primaryAction, ...area.secondaryActions, ...area.operations])
].filter((item, index, list) => list.findIndex((candidate) => candidate.href === item.href && candidate.label === item.label) === index);

const pagePresetEntries = managementAreas.flatMap((area) => [
  [area.href, area] as const,
  ...area.secondaryActions.map((action) => [action.href, area] as const),
  ...area.operations.map((operation) => [operation.href, area] as const)
]);

export const managementPagePresets = new Map<string, ManagementArea>();
for (const [href, area] of pagePresetEntries) {
  if (!managementPagePresets.has(href)) {
    managementPagePresets.set(href, area);
  }
}

export function getManagementAreaByHref(href: string) {
  return managementPagePresets.get(href) ?? managementAreas.find((area) => href === area.href || href.startsWith(`${area.href}/`));
}
