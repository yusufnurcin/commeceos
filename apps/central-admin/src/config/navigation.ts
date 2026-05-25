export type NavigationStatus =
  | "active"
  | "runtime-ready"
  | "empty"
  | "planned"
  | "requires-tenant"
  | "requires-odoo"
  | "requires-medusa"
  | "requires-integration"
  | "requires-license"
  | "requires-module"
  | "disabled";

export type NavigationAudience =
  | "central_admin"
  | "saas_admin"
  | "tenant_admin"
  | "seller"
  | "customer"
  | "courier"
  | "finance"
  | "accounting"
  | "design"
  | "ads"
  | "support";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface OperationalEmptyState {
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
}

export interface NavigationItem {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly href: string;
  readonly workspace: string;
  readonly group: string;
  readonly icon: string;
  readonly requiredRoles: readonly string[];
  readonly permissionKey: string;
  readonly status: NavigationStatus;
  readonly children: readonly NavigationItem[];
  readonly sourceInventoryRefs: readonly string[];
  readonly connectedRuntime: string | undefined;
  readonly connectedEngine: "gateway" | "odoo" | "medusa" | "redis" | "postgres" | "minio" | "meilisearch" | undefined;
  readonly emptyState: OperationalEmptyState;
  readonly primaryAction: string;
  readonly secondaryActions: readonly string[];
  readonly tags: readonly string[];
  readonly riskLevel: RiskLevel;
  readonly moduleKey: string;
  readonly featureFlag: string;
  readonly tenantScoped: boolean;
  readonly auditAction: string;
  readonly audience: readonly NavigationAudience[];
  readonly panelTarget: readonly NavigationAudience[];
}

interface ItemSeed {
  readonly segment: string;
  readonly label: string;
  readonly description: string;
  readonly status?: NavigationStatus;
  readonly engine?: NavigationItem["connectedEngine"];
  readonly runtime?: string;
  readonly moduleKey?: string;
  readonly permission?: string;
  readonly action?: string;
  readonly secondary?: readonly string[];
  readonly tags?: readonly string[];
  readonly risk?: RiskLevel;
  readonly tenantScoped?: boolean;
  readonly audience?: readonly NavigationAudience[];
  readonly panelTarget?: readonly NavigationAudience[];
  readonly refs?: readonly string[];
}

interface WorkspaceSeed {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly href: string;
  readonly icon: string;
  readonly group: string;
  readonly moduleKey: string;
  readonly permissionPrefix: string;
  readonly status: NavigationStatus;
  readonly audience?: readonly NavigationAudience[];
  readonly refs: readonly string[];
  readonly items: readonly ItemSeed[];
}

const adminRoles = ["super_admin", "platform_owner", "admin"] as const;

function words(value: string) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, ".")
    .replace(/([a-z0-9])([A-Z])/g, "$1.$2")
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
}

function emptyState(label: string, status: NavigationStatus, engine?: string): OperationalEmptyState {
  if (status === "runtime-ready") {
    return {
      title: `${label} hazır`,
      description: "Bağlı runtime sağlık sinyali alınıyor. Operasyon verisi oluştuğunda bu yüzey gerçek kayıtlarla dolar."
    };
  }
  if (status === "requires-odoo") {
    return {
      title: "Odoo köprüsü hazır, provisioning job bekliyor",
      description: "Ham Odoo arayüzü açılmaz. Odoo verisi Commerce OS mapping ve sync job akışıyla yönetilecek."
    };
  }
  if (status === "requires-medusa") {
    return {
      title: "Medusa API hazır, commerce sync bekliyor",
      description: "Medusa admin açılmaz. Catalog, pricing, cart, checkout ve order köprüleri Gateway üzerinden yönetilecek."
    };
  }
  if (status === "requires-integration") {
    return {
      title: "Entegrasyon bağlantısı bekleniyor",
      description: `${engine ?? "İlgili servis"} için credential, webhook veya mapping tamamlanmadan fake veri gösterilmez.`
    };
  }
  if (status === "requires-tenant") {
    return {
      title: "Tenant seçimi gerekiyor",
      description: "Bu alan tenant kapsamına bağlıdır. Önce tenant oluşturun veya mevcut tenant detayından ilerleyin.",
      actionLabel: "Yeni Tenant Oluştur"
    };
  }
  if (status === "requires-license") {
    return {
      title: "Lisans veya paket kararı bekleniyor",
      description: "Bu modül plan, lisans ya da paket bağlanmadan aktif operasyon üretmez."
    };
  }
  if (status === "disabled") {
    return {
      title: "Modül kapalı",
      description: "Platform sahibi modülü etkinleştirene kadar bu alan sadece mimari görünürlük sağlar."
    };
  }
  return {
    title: "Operasyon verisi bekleniyor",
    description: "Bu yüzey demo veri üretmez. Gerçek runtime, tenant, engine veya audit sinyali geldiğinde otomatik olarak dolar."
  };
}

function makeItem(seed: ItemSeed, workspace: WorkspaceSeed): NavigationItem {
  const href = seed.segment.startsWith("/") ? seed.segment : `${workspace.href.replace(/\/$/, "")}/${seed.segment}`;
  const segmentKey = words(seed.segment.replace(/^\//, "") || workspace.id);
  const permissionKey = seed.permission ?? `${workspace.permissionPrefix}.${segmentKey}.view`;
  const status = seed.status ?? "empty";
  const moduleKey = seed.moduleKey ?? workspace.moduleKey;
  const audience = seed.audience ?? workspace.audience ?? (["central_admin"] as const);

  return {
    id: `${workspace.id}.${segmentKey}`,
    label: seed.label,
    description: seed.description,
    href,
    workspace: workspace.label,
    group: workspace.group,
    icon: workspace.icon,
    requiredRoles: adminRoles,
    permissionKey,
    status,
    children: [],
    sourceInventoryRefs: [...workspace.refs, ...(seed.refs ?? [])],
    connectedRuntime: seed.runtime,
    connectedEngine: seed.engine,
    emptyState: emptyState(seed.label, status, seed.engine),
    primaryAction: seed.action ?? "Operasyon bağlantısını yapılandır",
    secondaryActions: seed.secondary ?? ["Audit kaydını incele", "Yetki kuralını gözden geçir"],
    tags: [...new Set([workspace.moduleKey, ...(seed.tags ?? [])])],
    riskLevel: seed.risk ?? "medium",
    moduleKey,
    featureFlag: `feature.${moduleKey}`,
    tenantScoped: seed.tenantScoped ?? false,
    auditAction: `${permissionKey}.accessed`,
    audience,
    panelTarget: seed.panelTarget ?? audience
  };
}

function workspaceItem(workspace: WorkspaceSeed): NavigationItem {
  const children = workspace.items.map((item) => makeItem(item, workspace));
  return {
    id: workspace.id,
    label: workspace.label,
    description: workspace.description,
    href: workspace.href,
    workspace: workspace.label,
    group: workspace.group,
    icon: workspace.icon,
    requiredRoles: adminRoles,
    permissionKey: `${workspace.permissionPrefix}.view`,
    status: workspace.status,
    children,
    sourceInventoryRefs: workspace.refs,
    connectedRuntime: workspace.id === "platform" ? "/runtime/health-matrix" : undefined,
    connectedEngine: workspace.id === "platform" ? "gateway" : undefined,
    emptyState: emptyState(workspace.label, workspace.status),
    primaryAction: "Workspace'i aç",
    secondaryActions: ["Komut paletine ekle", "Favorilere sabitle"],
    tags: [workspace.moduleKey],
    riskLevel: "medium",
    moduleKey: workspace.moduleKey,
    featureFlag: `feature.${workspace.moduleKey}`,
    tenantScoped: false,
    auditAction: `${workspace.permissionPrefix}.workspace.accessed`,
    audience: workspace.audience ?? ["central_admin"],
    panelTarget: workspace.audience ?? ["central_admin"]
  };
}

const workspaceSeeds: readonly WorkspaceSeed[] = [
  {
    id: "platform",
    label: "Komuta Merkezi",
    description: "Platform sağlığı, servis haritası, hızlı aksiyonlar ve global denetim görünümü.",
    href: "/platform",
    icon: "command",
    group: "Platform",
    moduleKey: "platform",
    permissionPrefix: "platform",
    status: "runtime-ready",
    refs: ["PDF: Dashboard", "PDF: Global Sistem Ayarları", "PDF: Sistem Yönetimi"],
    items: [
      { segment: "/platform/health", label: "Platform Durumu", description: "Gateway health matrix ve kritik servis durumu.", status: "runtime-ready", runtime: "/runtime/health-matrix", engine: "gateway", permission: "platform.health.view", action: "Health matrix'i yenile", risk: "high" },
      { segment: "/platform/topology", label: "Çalışma Zamanı Haritası", description: "Domain, queue, event ve runtime topolojisini gösterir.", status: "runtime-ready", runtime: "/runtime/topology", engine: "gateway", permission: "platform.topology.view" },
      { segment: "/platform/service-discovery", label: "Servis Keşfi", description: "Docker içi servis keşfi ve health probe kayıtları.", status: "runtime-ready", runtime: "/runtime/service-discovery", engine: "gateway", permission: "platform.service_discovery.view" },
      { segment: "settings", label: "Global Ayarlar", description: "Dil, para birimi, saat dilimi, bakım modu ve platform politikaları.", status: "planned", permission: "platform.settings.manage" },
      { segment: "notifications", label: "Sistem Bildirimleri", description: "Sistem, 2FA, sipariş ve pazarlama bildirim şablonları.", status: "requires-integration", engine: "gateway", permission: "platform.notifications.manage", moduleKey: "notifications" }
    ]
  },
  {
    id: "tenant-control",
    label: "Tenant Yönetimi",
    description: "Tenant yaşam döngüsü, domain, SSL/DNS, storage, realtime ve tenant denetimi.",
    href: "/tenants",
    icon: "building",
    group: "Platform",
    moduleKey: "tenant",
    permissionPrefix: "platform.tenants",
    status: "runtime-ready",
    refs: ["PDF: Tenant / Kiracı Yönetimi", "PDF: SaaS Tenant Yönetimi"],
    items: [
      { segment: "/tenants", label: "Tenant Listesi", description: "Gerçek tenant registry kayıtları.", status: "runtime-ready", runtime: "/v1/tenants", engine: "gateway", permission: "platform.tenants.view", action: "Yeni Tenant Oluştur" },
      { segment: "/tenants/new", label: "Yeni Tenant Oluştur", description: "Transaction içindeki ilk tenant provisioning akışı.", status: "runtime-ready", runtime: "/v1/tenants", engine: "gateway", permission: "platform.tenants.create" },
      { segment: "/tenant-control/domains", label: "Domain ve Alt Domainler", description: "Tenant domain, subdomain, DNS ve routing denetimi.", status: "requires-tenant", permission: "platform.tenants.domains.manage", tenantScoped: true },
      { segment: "/tenant-control/ssl-dns", label: "SSL ve DNS", description: "Sertifika, DNS doğrulama ve domain güvenliği.", status: "requires-integration", permission: "platform.tenants.ssl.manage", tenantScoped: true, risk: "high" },
      { segment: "/tenant-control/storage", label: "Depolama Alanı", description: "Tenant bucket, medya, kota ve storage namespace görünürlüğü.", status: "requires-tenant", engine: "minio", permission: "platform.tenants.storage.view", tenantScoped: true },
      { segment: "/tenant-control/realtime", label: "Realtime Kanalları", description: "Tenant izolasyonlu event ve realtime channel kayıtları.", status: "requires-tenant", engine: "redis", permission: "platform.tenants.realtime.view", tenantScoped: true },
      { segment: "/tenant-control/backups", label: "Tenant Yedekleri", description: "Backup, restore ve arşivleme kontrol noktası.", status: "planned", permission: "platform.tenants.backups.manage", tenantScoped: true, risk: "critical" },
      { segment: "/tenant-control/users", label: "Tenant Kullanıcıları", description: "Tenant admin, satıcı, müşteri ve personel erişim denetimi.", status: "requires-tenant", permission: "platform.tenants.users.view", tenantScoped: true }
    ]
  },
  {
    id: "saas",
    label: "SaaS ve Abonelik Yönetimi",
    description: "Plan, abonelik, faturalandırma, limit ve lisans mimarisi.",
    href: "/saas",
    icon: "layers",
    group: "Gelir",
    moduleKey: "saas",
    permissionPrefix: "saas",
    status: "planned",
    refs: ["PDF: SaaS Yönetimi", "PDF: SaaS Paketleri", "PDF: Abonelik Yönetimi"],
    items: [
      { segment: "plans", label: "SaaS Paketleri", description: "Plan, özellik, limit ve paket fiyatları.", status: "planned", permission: "saas.plans.manage", action: "Plan şeması oluştur" },
      { segment: "subscriptions", label: "Abonelikler", description: "Aktif, deneme, yenileme ve iptal akışları.", status: "planned", permission: "saas.subscriptions.manage" },
      { segment: "billing", label: "SaaS Faturalandırma", description: "SaaS faturaları, otomatik fatura ve vergi ayarları.", status: "planned", permission: "saas.billing.manage" },
      { segment: "payments", label: "SaaS Ödemeleri", description: "Ödeme sağlayıcıları, tahsilat ve ödeme logları.", status: "requires-integration", permission: "saas.payments.manage", moduleKey: "payments" },
      { segment: "limits", label: "Kullanım Limitleri", description: "Kullanıcı, ürün, depolama, trafik, API ve modül limitleri.", status: "planned", permission: "saas.limits.manage" },
      { segment: "licenses", label: "SaaS Lisansları", description: "Lisans, paket ve modül yetkilendirme kontrolü.", status: "requires-license", permission: "saas.licenses.manage" }
    ]
  },
  {
    id: "marketplace",
    label: "Marketplace Yönetimi",
    description: "Satıcı onayı, KYC, komisyon, mağaza ve marketplace denetimi.",
    href: "/marketplace",
    icon: "store",
    group: "Marketplace",
    moduleKey: "marketplace",
    permissionPrefix: "marketplace",
    status: "empty",
    refs: ["PDF: Satıcı Yönetimi", "PDF: Marketplace omurgası"],
    items: [
      { segment: "sellers", label: "Satıcılar", description: "Global satıcı registry ve platform denetimi.", status: "empty", permission: "marketplace.sellers.review", panelTarget: ["seller"] },
      { segment: "applications", label: "Satıcı Başvuruları", description: "Başvuru, onay ve risk kontrolü.", status: "empty", permission: "marketplace.seller_applications.review", panelTarget: ["seller"] },
      { segment: "kyc", label: "Satıcı KYC", description: "Belge, vergi levhası ve şirket evrak onayları.", status: "empty", permission: "marketplace.kyc.review", moduleKey: "security", panelTarget: ["seller", "support"] },
      { segment: "commissions", label: "Komisyon Kuralları", description: "Kategori, satıcı ve kampanya bazlı komisyon politikası.", status: "planned", permission: "marketplace.commissions.manage", moduleKey: "finance" },
      { segment: "stores", label: "Mağaza Denetimi", description: "Mağaza profil, politika, SEO ve ihlal görünürlüğü.", status: "empty", permission: "marketplace.stores.moderate", panelTarget: ["seller"] },
      { segment: "seller-performance", label: "Satıcı Performansı", description: "Ceza, ihlal, puan ve performans denetimi.", status: "empty", permission: "marketplace.sellers.performance.view", panelTarget: ["seller"] }
    ]
  },
  {
    id: "seller-ops",
    label: "Satıcı Operasyonları",
    description: "Satıcı günlük operasyonları seller-portal hedefli tutulur; Central Admin denetim sağlar.",
    href: "/seller-ops",
    icon: "briefcase",
    group: "Marketplace",
    moduleKey: "seller_operations",
    permissionPrefix: "seller_ops",
    status: "planned",
    audience: ["central_admin", "seller"],
    refs: ["PDF: seller panel 27 menü grubu"],
    items: [
      { segment: "products", label: "Satıcı Ürünleri", description: "Satıcı ürün akışı ve moderasyon kontrolü.", status: "planned", permission: "seller_ops.products.review", panelTarget: ["seller"] },
      { segment: "orders", label: "Satıcı Siparişleri", description: "Satıcı bazlı sipariş denetimi.", status: "planned", permission: "seller_ops.orders.view", panelTarget: ["seller"] },
      { segment: "wallets", label: "Satıcı Cüzdanları", description: "Satıcı bakiye, blokaj ve payout denetimi.", status: "planned", permission: "seller_ops.wallets.view", moduleKey: "finance", panelTarget: ["seller", "finance"] },
      { segment: "documents", label: "Satıcı Belgeleri", description: "KYC ve resmi evrak denetimi.", status: "planned", permission: "seller_ops.documents.review", moduleKey: "security", panelTarget: ["seller"] },
      { segment: "ads", label: "Satıcı Reklamları", description: "Satıcı reklam ve bütçe denetimi.", status: "planned", permission: "seller_ops.ads.view", moduleKey: "marketing", panelTarget: ["seller", "ads"] }
    ]
  },
  {
    id: "customer-ops",
    label: "Müşteri Operasyonları",
    description: "Müşteri hesap, sipariş, cüzdan ve destek akışları için global denetim.",
    href: "/customer-ops",
    icon: "users",
    group: "Marketplace",
    moduleKey: "customer_operations",
    permissionPrefix: "customer_ops",
    status: "planned",
    audience: ["central_admin", "customer"],
    refs: ["PDF: customer panel 16 menü grubu"],
    items: [
      { segment: "accounts", label: "Müşteri Hesapları", description: "Profil, güvenlik ve oturum denetimi.", status: "planned", permission: "customer_ops.accounts.view", panelTarget: ["customer", "support"] },
      { segment: "orders", label: "Müşteri Siparişleri", description: "Müşteri sipariş, iade ve fatura görünürlüğü.", status: "planned", permission: "customer_ops.orders.view", panelTarget: ["customer", "support"] },
      { segment: "wallets", label: "Müşteri Cüzdanları", description: "Bakiye, cashback, iade bakiyesi ve limit denetimi.", status: "planned", permission: "customer_ops.wallets.view", moduleKey: "finance", panelTarget: ["customer", "finance"] },
      { segment: "loyalty", label: "Sadakat ve Kuponlar", description: "Puan, seviye, kupon ve favori akış denetimi.", status: "planned", permission: "customer_ops.loyalty.view", moduleKey: "marketing", panelTarget: ["customer"] },
      { segment: "kyc", label: "Müşteri KYC", description: "Kimlik, adres ve telefon doğrulama denetimi.", status: "planned", permission: "customer_ops.kyc.review", moduleKey: "security", panelTarget: ["customer"] }
    ]
  },
  {
    id: "catalog",
    label: "Katalog ve Ürün Yönetimi",
    description: "Ürün, varyant, özellik, marka, etiket, yorum, soru ve bulk aktarım kontrolü.",
    href: "/catalog",
    icon: "package",
    group: "Commerce",
    moduleKey: "catalog",
    permissionPrefix: "catalog",
    status: "requires-medusa",
    refs: ["PDF: Ürün Yönetimi", "PDF: seller Ürün Yönetimi"],
    items: [
      { segment: "products", label: "Ürünler", description: "Global ürün görünürlüğü ve moderasyon.", status: "requires-medusa", engine: "medusa", permission: "catalog.products.view" },
      { segment: "variants", label: "Varyantlar", description: "Renk, beden, lisans, paket ve ürün varyant kontrolü.", status: "requires-medusa", engine: "medusa", permission: "catalog.variants.view" },
      { segment: "attributes", label: "Özellikler", description: "Dinamik özellik, filtre alanı ve ürün attribute mimarisi.", status: "planned", permission: "catalog.attributes.manage" },
      { segment: "brands", label: "Markalar", description: "Marka registry ve ürün eşleştirmeleri.", status: "planned", permission: "catalog.brands.manage" },
      { segment: "tags", label: "Etiketler", description: "Ürün, kampanya ve içerik etiket yönetimi.", status: "planned", permission: "catalog.tags.manage" },
      { segment: "comments", label: "Yorum ve Sorular", description: "Ürün yorumları, soruları ve moderasyon kuyruğu.", status: "planned", permission: "catalog.comments.moderate" },
      { segment: "bulk-transfer", label: "XML / CSV Aktarım", description: "Toplu import/export, hata raporu ve zamanlanmış aktarım.", status: "planned", permission: "catalog.bulk_transfer.manage", moduleKey: "data_ops" }
    ]
  },
  {
    id: "taxonomy",
    label: "Kategori ve Taksonomi",
    description: "Kategori ağacı, filtre, SEO/GEO, vergi, komisyon ve kargo kuralları.",
    href: "/catalog/categories",
    icon: "folder-tree",
    group: "Commerce",
    moduleKey: "taxonomy",
    permissionPrefix: "catalog.categories",
    status: "planned",
    refs: ["PDF: Kategori Yönetimi", "PDF: Global Kategori Eşleştirme"],
    items: [
      { segment: "/catalog/categories", label: "Kategoriler", description: "Ana, alt ve çok katmanlı kategori yönetimi.", status: "planned", permission: "catalog.categories.view" },
      { segment: "/catalog/taxonomy/filters", label: "Kategori Filtreleri", description: "Filtre alanları ve dinamik özellik eşleştirmeleri.", status: "planned", permission: "catalog.categories.filters.manage" },
      { segment: "/catalog/taxonomy/seo-geo", label: "Kategori SEO / GEO", description: "Kategori meta, bölgesel landing ve GEO alanları.", status: "planned", permission: "catalog.categories.seo.manage" },
      { segment: "/catalog/taxonomy/tax-rules", label: "Kategori Vergi Kuralları", description: "Kategori bazlı vergi rejimleri.", status: "planned", permission: "catalog.categories.tax.manage", moduleKey: "accounting" },
      { segment: "/catalog/taxonomy/shipping-rules", label: "Kategori Kargo Kuralları", description: "Kategori bazlı kargo ve desi kuralları.", status: "planned", permission: "catalog.categories.shipping.manage", moduleKey: "logistics" }
    ]
  },
  {
    id: "orders",
    label: "Sipariş Operasyonları",
    description: "Global sipariş, iade, refund, chargeback, dispute ve fraud görünürlüğü.",
    href: "/orders",
    icon: "receipt",
    group: "Commerce",
    moduleKey: "orders",
    permissionPrefix: "orders",
    status: "requires-medusa",
    refs: ["PDF: Sipariş Yönetimi", "PDF: Checkout ödeme gate"],
    items: [
      { segment: "/orders", label: "Global Siparişler", description: "Tenant ve satıcı kapsamlı sipariş denetimi.", status: "requires-medusa", engine: "medusa", permission: "orders.global.view" },
      { segment: "/orders/returns", label: "İade ve Değişim", description: "Return, exchange ve kısmi iade talepleri.", status: "requires-medusa", engine: "medusa", permission: "orders.returns.manage" },
      { segment: "/orders/refunds", label: "Refundlar", description: "Refund, chargeback ve dispute akışları.", status: "planned", permission: "orders.refunds.manage", moduleKey: "finance" },
      { segment: "/orders/fraud", label: "Fraud Şüpheli Siparişler", description: "Fraud kuralları, risk ve müdahale kuyruğu.", status: "planned", permission: "orders.fraud.review", moduleKey: "security", risk: "high" },
      { segment: "/orders/digital", label: "Dijital Siparişler", description: "Dijital teslimat, lisans ve abonelik siparişleri.", status: "planned", permission: "orders.digital.view" }
    ]
  },
  {
    id: "finance",
    label: "Ödeme, Cüzdan ve Finans",
    description: "Payment, wallet, payout, commission, escrow ve finansal risk kontrolü.",
    href: "/finance",
    icon: "wallet",
    group: "Finans",
    moduleKey: "finance",
    permissionPrefix: "finance",
    status: "planned",
    refs: ["PDF: Ödeme Yönetimi", "PDF: Cüzdan Sistemi", "PDF: finance panel"],
    items: [
      { segment: "wallets", label: "Cüzdanlar", description: "Müşteri, satıcı, kurye ve affiliate cüzdan denetimi.", status: "planned", permission: "finance.wallets.view" },
      { segment: "payments", label: "Ödemeler", description: "Başarılı, başarısız, bekleyen ve taksitli ödeme akışları.", status: "requires-integration", permission: "finance.payments.view", moduleKey: "payments" },
      { segment: "providers", label: "Ödeme Sağlayıcıları", description: "Stripe, PayPal, İyzico, PayTR, banka, SWIFT ve yerel sağlayıcılar.", status: "requires-integration", permission: "finance.providers.manage", moduleKey: "payments" },
      { segment: "payouts", label: "Payout ve Çekimler", description: "Satıcı, kurye ve affiliate ödeme talepleri.", status: "planned", permission: "finance.payouts.manage" },
      { segment: "commissions", label: "Komisyonlar", description: "Satıcı, reklam, affiliate ve marketplace komisyon kontrolü.", status: "planned", permission: "finance.commissions.manage" },
      { segment: "chargebacks", label: "Chargeback ve Dispute", description: "Chargeback, dispute ve riskli ödeme denetimi.", status: "planned", permission: "finance.chargebacks.review", risk: "high" }
    ]
  },
  {
    id: "accounting",
    label: "Muhasebe ve Vergi",
    description: "Fatura, e-fatura, vergi rejimleri, cari hesap ve finansal rapor kontrolü.",
    href: "/accounting",
    icon: "calculator",
    group: "Finans",
    moduleKey: "accounting",
    permissionPrefix: "accounting",
    status: "requires-odoo",
    refs: ["PDF: Vergi Yönetimi", "PDF: Fatura Yönetimi", "PDF: Muhasebe Yönetimi"],
    items: [
      { segment: "tax", label: "Vergi Rejimleri", description: "KDV, VAT, GST, Sales Tax ve bölgesel vergi kuralları.", status: "requires-odoo", engine: "odoo", permission: "accounting.tax.manage" },
      { segment: "invoices", label: "Faturalar", description: "E-fatura, e-arşiv, iade, SaaS ve komisyon faturaları.", status: "requires-odoo", engine: "odoo", permission: "accounting.invoices.manage" },
      { segment: "accounts", label: "Cari Hesaplar", description: "Satıcı, müşteri, banka, kasa, alacak ve borç kontrolü.", status: "requires-odoo", engine: "odoo", permission: "accounting.accounts.view" },
      { segment: "reports", label: "Muhasebe Raporları", description: "Kar/zarar, bilanço ve vergi muhasebesi.", status: "requires-odoo", engine: "odoo", permission: "accounting.reports.view" },
      { segment: "tax-number-validation", label: "Vergi Numarası Doğrulama", description: "B2B/B2C vergi kimlik doğrulama akışı.", status: "requires-integration", permission: "accounting.tax_number_validation.manage" }
    ]
  },
  {
    id: "erp",
    label: "ERP / Odoo Merkezi",
    description: "Odoo engine health, modül, model, mapping, sync ve conflict resolver merkezi.",
    href: "/erp",
    icon: "database",
    group: "Engine",
    moduleKey: "erp_odoo",
    permissionPrefix: "erp.odoo",
    status: "runtime-ready",
    refs: ["PDF: ERP Yönetimi", "PDF: Gömülü Odoo ERP", "PDF: Embedded Odoo/ERP analiz katmanı"],
    items: [
      { segment: "odoo", label: "Odoo Health", description: "Odoo engine TCP ve bridge hazırlık durumu.", status: "runtime-ready", runtime: "/runtime/health-matrix", engine: "odoo", permission: "erp.odoo.view" },
      { segment: "modules", label: "Odoo Modülleri", description: "Modül kataloğu ve kurulum denetimi.", status: "requires-odoo", engine: "odoo", permission: "erp.odoo.modules.manage" },
      { segment: "companies", label: "Şirketler", description: "Odoo company mapping ve tenant-company ilişkilendirme.", status: "requires-odoo", engine: "odoo", permission: "erp.odoo.companies.view", tenantScoped: true },
      { segment: "accounting", label: "Odoo Muhasebe", description: "Muhasebe, fatura ve vergi mapping kontrolü.", status: "requires-odoo", engine: "odoo", permission: "erp.odoo.accounting.view" },
      { segment: "inventory", label: "Stok ve Depo", description: "Stok, depo, transfer, satın alma ve tedarikçi mapping.", status: "requires-odoo", engine: "odoo", permission: "erp.odoo.inventory.view" },
      { segment: "crm-hr-pos", label: "CRM / HR / POS", description: "CRM, personel, vardiya, POS ve proje modülleri.", status: "requires-odoo", engine: "odoo", permission: "erp.odoo.enterprise_modules.view" },
      { segment: "schema", label: "Model ve Alan Şemaları", description: "Model, field, view, access rule ve record schema görünümü.", status: "requires-odoo", engine: "odoo", permission: "erp.odoo.schema.view" },
      { segment: "mapping-studio", label: "Mapping Studio", description: "Panel alan eşleme ve veri kayıt mapping merkezi.", status: "requires-odoo", engine: "odoo", permission: "erp.odoo.mapping.manage" },
      { segment: "sync-jobs", label: "Sync Jobs", description: "Odoo API senkronizasyon job ve DLQ kontrolü.", status: "requires-odoo", engine: "odoo", permission: "erp.odoo.sync.manage" },
      { segment: "conflicts", label: "Çakışma Çözümleyici", description: "Odoo ve Commerce OS veri çakışmalarını çözer.", status: "requires-odoo", engine: "odoo", permission: "erp.odoo.conflicts.resolve", risk: "high" },
      { segment: "audit", label: "Odoo Audit", description: "Odoo bridge operasyon audit görünürlüğü.", status: "requires-odoo", engine: "odoo", permission: "erp.odoo.audit.view" }
    ]
  },
  {
    id: "commerce",
    label: "Medusa Commerce Merkezi",
    description: "Medusa headless commerce engine health ve domain bridge yönetimi.",
    href: "/commerce",
    icon: "shopping-bag",
    group: "Engine",
    moduleKey: "medusa_commerce",
    permissionPrefix: "commerce.medusa",
    status: "runtime-ready",
    refs: ["PDF: Medusa commerce hedefi", "PDF: catalog/pricing/cart/checkout/order/return/promotion"],
    items: [
      { segment: "medusa", label: "Medusa Health", description: "Medusa API-only health ve admin ingress denetimi.", status: "runtime-ready", runtime: "medusa:/health", engine: "medusa", permission: "commerce.medusa.view" },
      { segment: "catalog-bridge", label: "Catalog Bridge", description: "Ürün ve katalog sync köprüsü.", status: "requires-medusa", engine: "medusa", permission: "commerce.medusa.catalog.sync.manage" },
      { segment: "pricing-bridge", label: "Pricing Bridge", description: "Fiyat, para birimi ve bölge köprüsü.", status: "requires-medusa", engine: "medusa", permission: "commerce.medusa.pricing.sync.manage" },
      { segment: "cart-checkout", label: "Cart / Checkout Bridge", description: "Cart ve ödeme gate korumalı checkout köprüsü.", status: "requires-medusa", engine: "medusa", permission: "commerce.medusa.checkout.sync.manage", risk: "high" },
      { segment: "order-return", label: "Order / Return Bridge", description: "Order, return, refund ve fulfillment köprüsü.", status: "requires-medusa", engine: "medusa", permission: "commerce.medusa.order.sync.manage" },
      { segment: "promotion-region-tax", label: "Promotion / Region / Tax", description: "Promotion, region ve tax domain orchestration.", status: "requires-medusa", engine: "medusa", permission: "commerce.medusa.domain.sync.manage" },
      { segment: "inventory-bridge", label: "Inventory Bridge", description: "Medusa inventory ile Odoo stock mapping denetimi.", status: "requires-medusa", engine: "medusa", permission: "commerce.medusa.inventory.sync.manage" },
      { segment: "mapping-studio", label: "Mapping Studio", description: "Medusa domain mapping ve conflict çözümü.", status: "requires-medusa", engine: "medusa", permission: "commerce.medusa.mapping.manage" },
      { segment: "sync-jobs", label: "Sync Jobs", description: "Medusa orchestration job ve audit kayıtları.", status: "requires-medusa", engine: "medusa", permission: "commerce.medusa.sync.manage" }
    ]
  },
  {
    id: "logistics",
    label: "Lojistik ve Kurye Operasyonları",
    description: "Kargo, depo, shipment, courier, route ve teslimat denetimi.",
    href: "/logistics",
    icon: "truck",
    group: "Operasyon",
    moduleKey: "logistics",
    permissionPrefix: "logistics",
    status: "planned",
    refs: ["PDF: Kargo ve Lojistik Yönetimi", "PDF: Teslimatçı / Kurye Yönetimi", "PDF: courier panel"],
    items: [
      { segment: "couriers", label: "Kuryeler", description: "Kurye başvuru, belge, KYC ve performans denetimi.", status: "planned", permission: "logistics.couriers.review", panelTarget: ["courier"] },
      { segment: "shipments", label: "Gönderiler", description: "Shipment, takip kodu ve teslimat süreci.", status: "planned", permission: "logistics.shipments.view" },
      { segment: "carriers", label: "Kargo Firmaları", description: "Global ve yerel kargo entegrasyonları.", status: "requires-integration", permission: "logistics.carriers.manage" },
      { segment: "warehouses", label: "Depolar", description: "Depo, transfer, raf ve stok hareket mapping.", status: "requires-odoo", engine: "odoo", permission: "logistics.warehouses.view" },
      { segment: "routes", label: "Rotalar", description: "Kurye rota, bölge ve teslimat sıralama kontrolü.", status: "planned", permission: "logistics.routes.view", panelTarget: ["courier"] },
      { segment: "returns", label: "İade Kargo Kuralları", description: "İade kargo, ücret ve bölge kuralları.", status: "planned", permission: "logistics.returns.manage" }
    ]
  },
  {
    id: "support",
    label: "Destek ve İletişim",
    description: "Ticket, canlı destek, chatbot, WhatsApp, SMS, email ve push görünürlüğü.",
    href: "/support",
    icon: "headphones",
    group: "İletişim",
    moduleKey: "support",
    permissionPrefix: "support",
    status: "requires-integration",
    refs: ["PDF: Destek", "PDF: Bildirim Sistemi", "PDF: WhatsApp/SMS/E-Posta Yönetimi"],
    items: [
      { segment: "tickets", label: "Destek Talepleri", description: "Müşteri, satıcı, tenant ve fatura destek talepleri.", status: "planned", permission: "support.tickets.manage", panelTarget: ["support"] },
      { segment: "chatbot", label: "Chatbot", description: "AI destek asistanı ve canlı destek entegrasyonu.", status: "requires-integration", permission: "support.chatbot.manage", moduleKey: "ai" },
      { segment: "whatsapp", label: "WhatsApp", description: "WhatsApp API, şablon, destek ve pazarlama akışları.", status: "requires-integration", permission: "support.whatsapp.manage" },
      { segment: "sms", label: "SMS", description: "SMS sağlayıcı, doğrulama, pazarlama ve loglar.", status: "requires-integration", permission: "support.sms.manage" },
      { segment: "email", label: "E-posta", description: "SMTP, transactional mail, newsletter ve bounce yönetimi.", status: "requires-integration", permission: "support.email.manage" },
      { segment: "push", label: "Push Bildirimleri", description: "Push, sistem ve sipariş bildirimleri.", status: "requires-integration", permission: "support.push.manage" }
    ]
  },
  {
    id: "marketing",
    label: "Reklam, Pazarlama ve Kampanyalar",
    description: "Reklam, kampanya, coupon, flash sale, loyalty, affiliate ve hikaye denetimi.",
    href: "/marketing",
    icon: "megaphone",
    group: "Büyüme",
    moduleKey: "marketing",
    permissionPrefix: "marketing",
    status: "planned",
    audience: ["central_admin", "ads"],
    refs: ["PDF: Reklam Yönetimi", "PDF: Kupon ve Kampanya", "PDF: Flash İndirim", "PDF: Affiliate", "PDF: Hikaye Yönetimi"],
    items: [
      { segment: "campaigns", label: "Kampanyalar", description: "Coupon, sepet, kategori ve zamanlanmış kampanya kontrolü.", status: "planned", permission: "marketing.campaigns.manage", panelTarget: ["ads", "seller"] },
      { segment: "ads", label: "Reklamlar", description: "Sponsorlu ürün, mağaza, banner, video ve bütçe denetimi.", status: "planned", permission: "marketing.ads.manage", panelTarget: ["ads"] },
      { segment: "coupons", label: "Kuponlar", description: "Satıcı, kategori, ürün ve ilk alışveriş kuponları.", status: "planned", permission: "marketing.coupons.manage" },
      { segment: "flash-sales", label: "Flash Sale", description: "Flash sale, başvuru, ürün ve sayaç denetimi.", status: "planned", permission: "marketing.flash_sales.manage" },
      { segment: "loyalty", label: "Sadakat", description: "Puan, seviye, cashback ve referans puanları.", status: "planned", permission: "marketing.loyalty.manage" },
      { segment: "affiliate", label: "Affiliate", description: "Partner programı, referans linkleri ve komisyonlar.", status: "planned", permission: "marketing.affiliate.manage" },
      { segment: "stories", label: "Hikaye Akışı", description: "Mağaza, kampanya ve story moderasyonu.", status: "planned", permission: "marketing.stories.moderate" }
    ]
  },
  {
    id: "design",
    label: "Tasarım, Tema ve Storefront",
    description: "Tema, storefront builder, kanal deneyimi, medya ve tasarım modülleri.",
    href: "/design",
    icon: "palette",
    group: "Deneyim",
    moduleKey: "storefront_builder",
    permissionPrefix: "design",
    status: "planned",
    audience: ["central_admin", "design"],
    refs: ["PDF: Tema Yönetimi", "PDF: Deneyim ve Kanal Merkezi", "PDF: design panel"],
    items: [
      { segment: "themes", label: "Temalar", description: "Tema marketi, aktif tema, lisans ve güncellemeler.", status: "planned", permission: "design.themes.manage", panelTarget: ["design", "tenant_admin"] },
      { segment: "builder", label: "Storefront Builder", description: "Tema yapıcı, header, footer, widget ve landing sayfa düzeni.", status: "planned", permission: "design.builder.manage", panelTarget: ["design"] },
      { segment: "channels", label: "Kanal Deneyimi", description: "Ana ön uç, kiracı ön uç ve site yapılandırma ayarları.", status: "planned", permission: "design.channels.manage" },
      { segment: "media", label: "Medya Kütüphanesi", description: "Görsel medya, banner, hikaye ve widget asset yönetimi.", status: "planned", permission: "design.media.manage" },
      { segment: "theme-modules", label: "Tema Modülleri", description: "Widget, CSS/JS ve Odoo tema entegrasyonları.", status: "planned", permission: "design.theme_modules.manage", moduleKey: "modules" }
    ]
  },
  {
    id: "cms",
    label: "CMS, SEO ve İçerik",
    description: "Sayfa, blog, medya, policy, SEO/GEO ve storefront içerik kontrolü.",
    href: "/cms",
    icon: "file-text",
    group: "Deneyim",
    moduleKey: "cms",
    permissionPrefix: "cms",
    status: "planned",
    refs: ["PDF: CMS Yönetimi", "PDF: SEO / GEO Yönetimi"],
    items: [
      { segment: "pages", label: "Sayfalar", description: "Sayfa, landing page, policy ve statik içerik yönetimi.", status: "planned", permission: "cms.pages.manage" },
      { segment: "blog", label: "Blog", description: "Blog yazıları, kategori ve etiketler.", status: "planned", permission: "cms.blog.manage" },
      { segment: "seo", label: "SEO", description: "Meta, canonical, sitemap, robots ve schema markup.", status: "planned", permission: "cms.seo.manage" },
      { segment: "geo", label: "GEO", description: "Bölgesel SEO, şehir landing page ve hreflang.", status: "planned", permission: "cms.geo.manage" },
      { segment: "menus", label: "Menü ve Navigasyon", description: "Header, footer, mega menü ve storefront linkleri.", status: "planned", permission: "cms.navigation.manage" },
      { segment: "forms", label: "Formlar ve SSS", description: "Form, popup, duyuru, SSS ve yardım merkezi.", status: "planned", permission: "cms.forms.manage" }
    ]
  },
  {
    id: "ai",
    label: "AI Operasyonları",
    description: "AI chatbot, SEO, çeviri, fiyatlandırma, stok tahmini, fraud ve moderasyon.",
    href: "/ai",
    icon: "sparkles",
    group: "Akıllı Operasyon",
    moduleKey: "ai",
    permissionPrefix: "ai.operations",
    status: "runtime-ready",
    refs: ["PDF: Yapay Zeka Yönetimi", "PDF: AI Önerileri"],
    items: [
      { segment: "/ai", label: "AI Operasyon Merkezi", description: "AI engine health ve operasyon sinyalleri.", status: "runtime-ready", runtime: "/runtime/health-matrix", engine: "gateway", permission: "ai.operations.view" },
      { segment: "/ai/chatbot", label: "AI Chatbot", description: "Destek asistanı ve müşteri yanıtları.", status: "requires-integration", permission: "ai.chatbot.manage" },
      { segment: "/ai/content", label: "İçerik Üretimi", description: "Ürün açıklaması, blog, SEO ve çeviri üretimi.", status: "planned", permission: "ai.content.manage" },
      { segment: "/ai/pricing-stock", label: "Fiyat ve Stok Tahmini", description: "Dinamik fiyatlandırma ve stok tahmini.", status: "planned", permission: "ai.pricing_stock.view" },
      { segment: "/ai/fraud-moderation", label: "Fraud ve Moderasyon", description: "Fraud detection, ürün/satıcı/müşteri moderasyon sinyalleri.", status: "planned", permission: "ai.fraud_moderation.view", risk: "high" },
      { segment: "/ai/segments", label: "Müşteri Segmentasyonu", description: "AI segment, öneri ve kampanya hedefleme.", status: "planned", permission: "ai.segments.view" }
    ]
  },
  {
    id: "security",
    label: "Güvenlik, KYC ve Uyum",
    description: "RBAC, ABAC, roles, permissions, sessions, KYC, audit ve compliance.",
    href: "/security",
    icon: "shield",
    group: "Güvenlik",
    moduleKey: "security",
    permissionPrefix: "security",
    status: "runtime-ready",
    refs: ["PDF: Rol ve Yetki Yönetimi", "PDF: KYC ve Belge", "PDF: Güvenlik Merkezi"],
    items: [
      { segment: "audit", label: "Audit Logs", description: "Auth, provisioning, session ve runtime audit olayları.", status: "runtime-ready", runtime: "/v1/audit/runtime", engine: "gateway", permission: "security.audit.view", risk: "high" },
      { segment: "roles", label: "Roller", description: "Rol, rol grubu, yetki şablonu ve panel hedefleri.", status: "planned", permission: "security.roles.manage", risk: "high" },
      { segment: "permissions", label: "Yetkiler", description: "Menü, modül, API, finans ve personel permission keyleri.", status: "planned", permission: "security.permissions.manage", risk: "critical" },
      { segment: "sessions", label: "Oturumlar", description: "Aktif oturum, cihaz takibi ve şüpheli girişler.", status: "runtime-ready", runtime: "/v1/auth/sessions", engine: "gateway", permission: "security.sessions.manage" },
      { segment: "kyc", label: "KYC ve Belgeler", description: "Müşteri, satıcı, kurye ve SaaS müşteri belgeleri.", status: "planned", permission: "security.kyc.review", risk: "high" },
      { segment: "fraud", label: "Fraud Kuralları", description: "Ödeme, sipariş ve hesap risk kuralları.", status: "planned", permission: "security.fraud.manage", risk: "high" },
      { segment: "compliance", label: "KVKK / GDPR", description: "Uyum, çerez, veri silme ve privacy politikaları.", status: "planned", permission: "security.compliance.manage", risk: "critical" }
    ]
  },
  {
    id: "integrations",
    label: "API, Entegrasyon ve Webhooklar",
    description: "API keys, webhook, REST/GraphQL, rate limit, developer portal ve provider bağlantıları.",
    href: "/integrations",
    icon: "plug",
    group: "Platform",
    moduleKey: "integrations",
    permissionPrefix: "integrations",
    status: "planned",
    refs: ["PDF: API Yönetimi", "PDF: Deneyim ve Kanal API/Webhook", "PDF: SMTP/SMS/WhatsApp"],
    items: [
      { segment: "api-keys", label: "API Anahtarları", description: "API key, kullanıcı ve permission denetimi.", status: "planned", permission: "integrations.api_keys.manage", risk: "high" },
      { segment: "webhooks", label: "Webhooklar", description: "Webhook endpoint, retry, imza ve event mapping.", status: "planned", permission: "integrations.webhooks.manage", risk: "high" },
      { segment: "rest-graphql", label: "REST / GraphQL", description: "API dokümantasyonu ve developer portal.", status: "planned", permission: "integrations.apis.view" },
      { segment: "rate-limits", label: "Rate Limit", description: "API, auth ve Gateway rate limit politikaları.", status: "runtime-ready", runtime: "/health", engine: "gateway", permission: "integrations.rate_limits.manage" },
      { segment: "provider-status", label: "Provider Durumları", description: "SMTP, SMS, WhatsApp, ödeme ve kargo provider durumları.", status: "requires-integration", permission: "integrations.providers.view" }
    ]
  },
  {
    id: "modules",
    label: "Modül, Eklenti ve Uzantı Merkezi",
    description: "Module registry, plugin market, lisans, dependency, hook, event ve rollback kontrolü.",
    href: "/modules",
    icon: "puzzle",
    group: "Platform",
    moduleKey: "modules",
    permissionPrefix: "modules.extensions",
    status: "planned",
    refs: ["PDF: Eklenti / Modül Yönetimi", "PDF: SaaS Modül Yönetimi"],
    items: [
      { segment: "/modules", label: "Tüm Modüller", description: "Aktif, pasif, planned ve disabled modül görünümü.", status: "planned", permission: "modules.extensions.manage" },
      { segment: "/modules/marketplace", label: "Modül Marketi", description: "Modül marketi, yükleme ve güncelleme akışı.", status: "requires-license", permission: "modules.marketplace.manage" },
      { segment: "/modules/licenses", label: "Modül Lisansları", description: "Lisans, paket ve dependency kontrolü.", status: "requires-license", permission: "modules.licenses.manage" },
      { segment: "/modules/hooks-events", label: "Hook ve Event Yönetimi", description: "Hook, event ve modül log bağlantıları.", status: "planned", permission: "modules.hooks_events.manage" },
      { segment: "/modules/odoo-integrations", label: "Odoo Modül Entegrasyonları", description: "Odoo modülü ve Commerce OS modülü eşleştirme.", status: "requires-odoo", engine: "odoo", permission: "modules.odoo_integrations.manage" },
      { segment: "/modules/rollback", label: "Geri Alma", description: "Modül rollback ve güvenli devre dışı bırakma.", status: "planned", permission: "modules.rollback.manage", risk: "high" }
    ]
  },
  {
    id: "reports",
    label: "Raporlama ve Analitik",
    description: "Global raporlar, satış, ürün, satıcı, müşteri, finans, reklam, kargo, vergi, SaaS ve AI raporları.",
    href: "/reports",
    icon: "bar-chart",
    group: "Analitik",
    moduleKey: "reports",
    permissionPrefix: "reports",
    status: "planned",
    refs: ["PDF: Raporlama ve Analitik"],
    items: [
      { segment: "/reports", label: "Global Raporlar", description: "Platform geneli gerçek raporlama yüzeyi.", status: "planned", permission: "reports.global.view" },
      { segment: "/reports/sales", label: "Satış Raporları", description: "Satış, order, category ve currency raporları.", status: "planned", permission: "reports.sales.view" },
      { segment: "/reports/finance", label: "Finans Raporları", description: "Wallet, payout, commission ve vergi raporları.", status: "planned", permission: "reports.finance.view", moduleKey: "finance" },
      { segment: "/reports/marketplace", label: "Marketplace Raporları", description: "Satıcı, müşteri ve reklam raporları.", status: "planned", permission: "reports.marketplace.view", moduleKey: "marketplace" },
      { segment: "/reports/builder", label: "Özel Rapor Oluşturucu", description: "Permission-aware rapor builder altyapısı.", status: "planned", permission: "reports.builder.manage" }
    ]
  },
  {
    id: "system",
    label: "Sistem Operasyonları",
    description: "Docker, queue, cache, storage, logs, backup, restore ve platform operasyonları.",
    href: "/system",
    icon: "server",
    group: "Platform",
    moduleKey: "system",
    permissionPrefix: "system",
    status: "runtime-ready",
    refs: ["PDF: Sistem Yönetimi"],
    items: [
      { segment: "logs", label: "Sistem Logları", description: "Gateway, engine ve runtime log görünürlüğü.", status: "planned", permission: "system.logs.view" },
      { segment: "queues", label: "Queue ve DLQ", description: "Queue state, dead letter ve replay denetimi.", status: "runtime-ready", runtime: "/v1/queues/runtime", engine: "redis", permission: "system.queues.view" },
      { segment: "docker", label: "Docker Servisleri", description: "Container health ve runtime servisleri.", status: "runtime-ready", runtime: "/runtime/health-matrix", engine: "gateway", permission: "system.docker.view" },
      { segment: "cache", label: "Cache", description: "Redis, cache namespace ve tenant cache görünürlüğü.", status: "runtime-ready", runtime: "/runtime/health-matrix", engine: "redis", permission: "system.cache.manage" },
      { segment: "storage", label: "Dosya Depolama", description: "MinIO bucket ve storage namespace denetimi.", status: "runtime-ready", runtime: "/runtime/health-matrix", engine: "minio", permission: "system.storage.view" },
      { segment: "backup-restore", label: "Yedekleme / Geri Yükleme", description: "Backup, restore ve veri kurtarma operasyonları.", status: "planned", permission: "system.backup_restore.manage", risk: "critical" }
    ]
  },
  {
    id: "localization",
    label: "Ülke, Dil, Para Birimi ve Yerelleştirme",
    description: "Country, currency, language, locale, tax regime ve bölgesel ayarlar.",
    href: "/localization",
    icon: "globe",
    group: "Platform",
    moduleKey: "localization",
    permissionPrefix: "localization",
    status: "planned",
    refs: ["PDF: Çoklu para birimi, ülke/locale", "PDF: Ülke Bazlı Vergiler"],
    items: [
      { segment: "countries", label: "Ülkeler", description: "Ülke, bölge, şehir ve kısıtlama ayarları.", status: "planned", permission: "localization.countries.manage" },
      { segment: "currencies", label: "Para Birimleri", description: "Default currency, provider ve FX ayarları.", status: "planned", permission: "localization.currencies.manage" },
      { segment: "languages", label: "Diller", description: "Dil, locale ve çeviri kapsamı.", status: "planned", permission: "localization.languages.manage" },
      { segment: "timezones", label: "Zaman Dilimleri", description: "Tenant ve platform timezone politikaları.", status: "planned", permission: "localization.timezones.manage" },
      { segment: "tax-regimes", label: "Vergi Rejimleri", description: "Ülke ve bölge bazlı vergi rejimleri.", status: "planned", permission: "localization.tax_regimes.manage", moduleKey: "accounting" }
    ]
  },
  {
    id: "data-ops",
    label: "Veri İçe/Dışa Aktarım ve Yedekleme",
    description: "CSV, XML, JSON import/export, tenant migration ve restore kontrolü.",
    href: "/data-ops",
    icon: "import",
    group: "Platform",
    moduleKey: "data_ops",
    permissionPrefix: "data_ops",
    status: "planned",
    refs: ["PDF: XML / CSV İşlemleri", "PDF: SaaS Veri Yönetimi", "PDF: CSV XML İçe Aktarım"],
    items: [
      { segment: "imports", label: "İçe Aktarım", description: "CSV, XML ve JSON import batch denetimi.", status: "planned", permission: "data_ops.imports.manage" },
      { segment: "exports", label: "Dışa Aktarım", description: "Tenant, katalog, finans ve rapor export akışları.", status: "planned", permission: "data_ops.exports.manage" },
      { segment: "templates", label: "Aktarım Şablonları", description: "Ürün, stok, fiyat ve kategori eşleştirme şablonları.", status: "planned", permission: "data_ops.templates.manage" },
      { segment: "migration", label: "Tenant Veri Taşıma", description: "Tenant migration, arşiv ve silme talepleri.", status: "planned", permission: "data_ops.migration.manage", risk: "critical" },
      { segment: "backups", label: "Yedekler", description: "Tenant backup, restore ve sistem yedekleri.", status: "planned", permission: "data_ops.backups.manage", risk: "critical" }
    ]
  },
  {
    id: "staff",
    label: "Personel ve İç Operasyon",
    description: "Personel, departman, görev, vardiya, performans ve iç log görünürlüğü.",
    href: "/staff",
    icon: "id-card",
    group: "İç Operasyon",
    moduleKey: "staff",
    permissionPrefix: "staff",
    status: "planned",
    refs: ["PDF: Personel Takip Sistemi", "PDF: ERP Yönetimi HR"],
    items: [
      { segment: "employees", label: "Çalışanlar", description: "Personel, departman, pozisyon ve roller.", status: "planned", permission: "staff.employees.manage" },
      { segment: "shifts", label: "Vardiyalar", description: "Vardiya, izin, mesai ve uzaktan çalışma takibi.", status: "planned", permission: "staff.shifts.manage" },
      { segment: "tasks", label: "Görevler", description: "Görev atama ve iç operasyon iş akışları.", status: "planned", permission: "staff.tasks.manage" },
      { segment: "payroll", label: "Maaşlar", description: "Maaş ve personel finans bağlantısı.", status: "requires-odoo", engine: "odoo", permission: "staff.payroll.view", moduleKey: "accounting" },
      { segment: "performance", label: "Performans", description: "Personel performansı, loglar ve GPS takip.", status: "planned", permission: "staff.performance.view" }
    ]
  },
  {
    id: "licensing",
    label: "Lisans, Plan ve Paket Yönetimi",
    description: "SaaS plan, modül lisansı, tema lisansı ve paket kontrol noktası.",
    href: "/licensing",
    icon: "badge-check",
    group: "Gelir",
    moduleKey: "licensing",
    permissionPrefix: "licensing",
    status: "requires-license",
    refs: ["PDF: SaaS Lisansları", "PDF: Modül Lisansları", "PDF: Tema Lisansları"],
    items: [
      { segment: "plans", label: "Plan Kataloğu", description: "Plan ve paket kataloğu.", status: "requires-license", permission: "licensing.plans.manage" },
      { segment: "module-licenses", label: "Modül Lisansları", description: "Modül lisans, limit ve dependency kontrolü.", status: "requires-license", permission: "licensing.modules.manage" },
      { segment: "theme-licenses", label: "Tema Lisansları", description: "Tema market, lisans ve update kontrolü.", status: "requires-license", permission: "licensing.themes.manage", moduleKey: "storefront_builder" },
      { segment: "tenant-entitlements", label: "Tenant Hakları", description: "Tenant bazlı module, theme, API ve limit yetkileri.", status: "requires-license", permission: "licensing.entitlements.manage", tenantScoped: true },
      { segment: "package-audit", label: "Paket Audit", description: "Paket değişiklikleri ve lisans audit görünürlüğü.", status: "requires-license", permission: "licensing.audit.view" }
    ]
  }
];

export const navigationManifest: readonly NavigationItem[] = workspaceSeeds.map(workspaceItem);

export const flattenedNavigation = navigationManifest.flatMap((workspace) => [workspace, ...workspace.children]);

export function findNavigationItemByHref(href: string) {
  const normalized = href.length > 1 ? href.replace(/\/$/, "") : href;
  return flattenedNavigation.find((item) => item.href.replace(/\/$/, "") === normalized);
}

export function getWorkspaceByHref(href: string) {
  const normalized = href.length > 1 ? href.replace(/\/$/, "") : href;
  return navigationManifest.find((item) => item.href.replace(/\/$/, "") === normalized || normalized.startsWith(`${item.href.replace(/\/$/, "")}/`));
}

export const navigationStats = {
  sourcePanels: 15,
  sourceMenuGroups: 211,
  sourceMenuItems: 1834,
  sourcePermissions: 2910,
  sourceBlueprintApiEndpoints: 2910,
  normalizedWorkspaceCount: navigationManifest.length,
  normalizedRouteCount: flattenedNavigation.length,
  normalizedPermissionCount: new Set(flattenedNavigation.map((item) => item.permissionKey)).size,
  repeatedMenusMerged: [
    "Gömülü Odoo ERP -> ERP / Odoo Merkezi",
    "Deneyim ve Kanal Merkezi -> Tasarım, Tema ve Storefront",
    "Cüzdan tekrarları -> Ödeme, Cüzdan ve Finans",
    "Vergi ve Fatura tekrarları -> Muhasebe ve Vergi",
    "SMTP/SMS/WhatsApp tekrarları -> Destek ve İletişim + API Entegrasyonları",
    "Hikaye ve kampanya tekrarları -> Reklam, Pazarlama ve Kampanyalar"
  ],
  movedToPanelTargets: [
    "Satıcı günlük ürün/sipariş/cüzdan işleri -> seller-portal",
    "Müşteri hesap/sipariş/cüzdan işleri -> customer-account",
    "Kurye teslimat/rota/kazanç işleri -> courier-app",
    "Tenant içi mağaza/SaaS operasyonları -> tenant-portal",
    "Tema üretim operasyonları -> design workspace",
    "Reklam operasyonları -> ads workspace"
  ]
} as const;
