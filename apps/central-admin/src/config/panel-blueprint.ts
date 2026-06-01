export type BlueprintStatus =
  | "runtime_ready"
  | "planned"
  | "provider_required"
  | "integration_required"
  | "enterprise_risk"
  | "license_review_required"
  | "disabled";

export interface PdfSourcePanel {
  readonly sourceName: string;
  readonly panelName: string;
  readonly routePrefix: string;
  readonly roles: readonly string[];
  readonly menuGroupCount: number;
  readonly menuItemCount: number;
  readonly permissionCount: number;
}

export interface CapabilityBlueprint {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly moduleKey: string;
  readonly permissionPrefix: string;
  readonly status: BlueprintStatus;
  readonly panelTargets: readonly string[];
  readonly route?: string | undefined;
  readonly providerKey?: string | undefined;
  readonly tags: readonly string[];
}

export interface PanelBlueprint {
  readonly panelKey: string;
  readonly panelName: string;
  readonly routePrefix: string;
  readonly audience: string;
  readonly roleTargets: readonly string[];
  readonly menuGroups: readonly string[];
  readonly moduleBindings: readonly string[];
  readonly statusDistribution: Readonly<Record<BlueprintStatus, number>>;
  readonly permissionPrefix: string;
  readonly panelTarget: string;
  readonly tenantScope: "global" | "tenant" | "mixed";
  readonly providerScope: readonly string[];
  readonly metadata: {
    readonly sourceName: string;
    readonly sourceAliases: readonly string[];
    readonly sourceInventoryRefs: readonly string[];
  };
}

export const pdfInventorySummary = {
  source: "ecommerce_saas_sistem_envanter_raporu_2026-05-21_150709(1).pdf",
  generatedAt: "2026-05-21T15:07:09+03:00",
  panelCount: 15,
  menuGroupCount: 211,
  menuItemCount: 1834,
  permissionCount: 2910,
  blueprintApiEndpointCount: 2910,
  blueprintDatabaseTableCount: 70
} as const;

export const pdfSourcePanels: readonly PdfSourcePanel[] = [
  { sourceName: "super_admin", panelName: "Genel Yönetim / Süper Admin Paneli", routePrefix: "central-admin", roles: ["super_admin", "platform_owner", "admin"], menuGroupCount: 43, menuItemCount: 578, permissionCount: 886 },
  { sourceName: "saas_admin", panelName: "SaaS Admin Paneli", routePrefix: "saas-admin", roles: ["saas_admin", "super_admin"], menuGroupCount: 15, menuItemCount: 138, permissionCount: 219 },
  { sourceName: "seller", panelName: "Satıcı Paneli", routePrefix: "seller", roles: ["seller", "vendor_admin", "vendor"], menuGroupCount: 27, menuItemCount: 253, permissionCount: 407 },
  { sourceName: "customer", panelName: "Müşteri Paneli", routePrefix: "account", roles: ["customer"], menuGroupCount: 16, menuItemCount: 108, permissionCount: 172 },
  { sourceName: "courier", panelName: "Teslimatçı / Kurye Paneli", routePrefix: "courier", roles: ["courier", "delivery_admin"], menuGroupCount: 9, menuItemCount: 61, permissionCount: 90 },
  { sourceName: "ads", panelName: "Reklam Paneli", routePrefix: "ads", roles: ["ads_admin", "advertiser"], menuGroupCount: 11, menuItemCount: 86, permissionCount: 134 },
  { sourceName: "finance", panelName: "Finans Paneli", routePrefix: "finance", roles: ["finance_admin", "super_admin"], menuGroupCount: 12, menuItemCount: 102, permissionCount: 164 },
  { sourceName: "accounting", panelName: "Muhasebe Paneli", routePrefix: "accounting", roles: ["accounting_admin", "finance_admin"], menuGroupCount: 12, menuItemCount: 94, permissionCount: 146 },
  { sourceName: "design", panelName: "Tasarım Paneli", routePrefix: "design", roles: ["designer", "tenant_admin"], menuGroupCount: 12, menuItemCount: 93, permissionCount: 142 },
  { sourceName: "saas_user", panelName: "SaaS Kullanıcı Paneli", routePrefix: "tenant-admin", roles: ["saas_owner", "tenant_admin"], menuGroupCount: 12, menuItemCount: 83, permissionCount: 152 },
  { sourceName: "saas_customer", panelName: "SaaS Müşteri Paneli", routePrefix: "tenant-account", roles: ["saas_customer"], menuGroupCount: 7, menuItemCount: 33, permissionCount: 51 },
  { sourceName: "saas_seller", panelName: "SaaS Satıcı Paneli", routePrefix: "tenant-seller", roles: ["saas_seller", "tenant_vendor"], menuGroupCount: 11, menuItemCount: 69, permissionCount: 114 },
  { sourceName: "saas_courier", panelName: "SaaS Teslimatçı Paneli", routePrefix: "tenant-courier", roles: ["saas_courier", "tenant_courier"], menuGroupCount: 6, menuItemCount: 24, permissionCount: 41 },
  { sourceName: "saas_design", panelName: "SaaS Tasarım Paneli", routePrefix: "tenant-design", roles: ["saas_designer", "tenant_designer"], menuGroupCount: 9, menuItemCount: 57, permissionCount: 95 },
  { sourceName: "saas_ads", panelName: "SaaS Reklam Paneli", routePrefix: "tenant-ads", roles: ["saas_ads_admin", "tenant_advertiser"], menuGroupCount: 9, menuItemCount: 55, permissionCount: 97 }
] as const;

function capability(
  key: string,
  label: string,
  description: string,
  moduleKey: string,
  panelTargets: readonly string[],
  options: {
    readonly status?: BlueprintStatus;
    readonly route?: string;
    readonly providerKey?: string;
    readonly tags?: readonly string[];
  } = {}
): CapabilityBlueprint {
  return {
    key,
    label,
    description,
    moduleKey,
    permissionPrefix: key.replace(/_/g, "."),
    status: options.status ?? "planned",
    panelTargets,
    route: options.route,
    providerKey: options.providerKey,
    tags: options.tags ?? []
  };
}

export const capabilityBlueprints: readonly CapabilityBlueprint[] = [
  capability("dashboard", "Dashboard", "Operasyon özeti, sistem durumu ve hızlı aksiyonlar.", "platform", ["central_admin", "admin"], { status: "runtime_ready", route: "/" }),
  capability("saas_tenant_management", "SaaS ve Tenant Yönetimi", "Tenant yaşam döngüsü, domain, storage ve workspace denetimi.", "tenants", ["central_admin", "admin", "tenant_admin"], { status: "runtime_ready", route: "/tenants" }),
  capability("users_roles_permissions", "Kullanıcı, Rol ve Yetki", "Kullanıcı, rol, RBAC, ABAC ve permission kapsamı.", "security", ["central_admin", "admin", "tenant_admin"], { route: "/security/roles" }),
  capability("tenant_plans_subscriptions", "Tenant Paketleri ve Abonelik", "Paket, limit, abonelik, fatura ve entitlement alanı.", "subscriptions", ["central_admin", "admin", "tenant_admin"], { route: "/saas/plans" }),
  capability("marketplace_sellers", "Marketplace ve Satıcı Yönetimi", "Satıcı başvuru, profil, moderasyon ve yaşam döngüsü.", "marketplace", ["central_admin", "admin", "seller", "tenant_seller"], { status: "runtime_ready", route: "/marketplace/sellers" }),
  capability("seller_kyc_documents", "Seller KYC ve Evrak", "Satıcı belge metadata, onay ve red akışı.", "seller_kyc", ["central_admin", "admin", "seller", "support"], { status: "runtime_ready", route: "/marketplace/kyc" }),
  capability("customer_management", "Müşteri Yönetimi", "Müşteri hesap, güvenlik, sipariş ve destek görünürlüğü.", "customers", ["central_admin", "admin", "customer", "tenant_customer", "support"], { route: "/customer-ops/accounts" }),
  capability("catalog_products", "Ürün ve Katalog", "Commerce OS Core ürün yaşam döngüsü ve moderasyon.", "catalog", ["central_admin", "admin", "seller", "tenant_seller"], { status: "runtime_ready", route: "/catalog/products" }),
  capability("catalog_categories", "Kategori Yönetimi", "Kategori ağacı, taksonomi ve SEO metadata.", "catalog", ["central_admin", "admin", "seller", "tenant_seller"], { status: "runtime_ready", route: "/catalog/categories" }),
  capability("variants_inventory", "Varyant ve Stok", "Ürün varyantları ve stok hazırlığı.", "catalog", ["central_admin", "admin", "seller", "tenant_seller"], { status: "runtime_ready", route: "/catalog/variants" }),
  capability("orders", "Sipariş Yönetimi", "Commerce OS Core sipariş ve kalem yaşam döngüsü.", "orders", ["central_admin", "admin", "seller", "customer", "tenant_admin"], { status: "runtime_ready", route: "/orders" }),
  capability("returns_refunds", "İade ve Refund", "İade talebi, refund ve iç operasyon kararları.", "orders", ["central_admin", "admin", "seller", "customer", "finance"], { status: "runtime_ready", route: "/orders/returns" }),
  capability("payment_providers", "Ödeme Sağlayıcıları", "Ödeme provider kataloğu ve dayanıklılık ayarları.", "payments", ["central_admin", "finance", "developer_api"], { status: "integration_required", route: "/settings/integrations", providerKey: "payment_provider" }),
  capability("wallets_payouts", "Cüzdan ve Payout", "Müşteri, satıcı, kurye ve affiliate bakiye akışları.", "wallets", ["central_admin", "finance", "seller", "courier"], { route: "/finance/wallets" }),
  capability("commissions", "Komisyon", "Marketplace, kategori, reklam ve affiliate komisyonları.", "finance", ["central_admin", "finance", "seller", "ads"], { route: "/finance/commissions" }),
  capability("accounting", "Muhasebe", "Cari hesap, gelir, gider ve finansal rapor hazırlığı.", "accounting", ["central_admin", "accounting", "finance"], { status: "provider_required", route: "/accounting/accounts", providerKey: "erp_provider" }),
  capability("tax", "Vergi", "KDV, VAT, GST ve ülke bazlı vergi rejimleri.", "tax", ["central_admin", "accounting", "finance"], { status: "provider_required", route: "/accounting/tax", providerKey: "erp_provider" }),
  capability("invoicing", "Fatura", "E-fatura, e-arşiv, iade ve komisyon faturası hazırlığı.", "invoicing", ["central_admin", "accounting", "finance", "seller"], { status: "provider_required", route: "/accounting/invoices", providerKey: "invoice_provider" }),
  capability("erp_provider_center", "ERP Provider Center", "ERP provider seçimi, durum ve kontrollü bridge kapsamı.", "erp", ["central_admin", "accounting", "developer_api"], { status: "provider_required", route: "/erp/odoo", providerKey: "erp_provider" }),
  capability("odoo_provider", "Odoo Provider", "Odoo health gerçek; mapping, sync ve worker kısmen hazır.", "erp_odoo", ["central_admin", "accounting", "developer_api"], { status: "provider_required", route: "/erp/odoo", providerKey: "odoo" }),
  capability("odoo_enterprise_addons", "Odoo Enterprise Addon Sınırı", "Community ve Enterprise addon ayrımı hukuk ve lisans kontrolü gerektirir.", "erp_odoo", ["central_admin", "accounting", "developer_api"], { status: "enterprise_risk", route: "/erp/odoo", providerKey: "odoo" }),
  capability("erpnext_provider", "ERPNext Provider", "Alternatif ERP provider sözleşme alanı.", "erp", ["central_admin", "accounting", "developer_api"], { status: "provider_required", route: "/blueprints", providerKey: "erpnext" }),
  capability("apache_ofbiz_provider", "Apache OFBiz Provider", "Alternatif ERP provider sözleşme alanı.", "erp", ["central_admin", "accounting", "developer_api"], { status: "provider_required", route: "/blueprints", providerKey: "apache_ofbiz" }),
  capability("medusa_commerce_provider", "Medusa Commerce Provider", "Opsiyonel commerce sync provider; Core bağımsız çalışır.", "medusa_commerce", ["central_admin", "developer_api"], { status: "provider_required", route: "/commerce/medusa", providerKey: "medusa" }),
  capability("shipping_logistics", "Kargo ve Lojistik", "Kargo firması, gönderi, takip ve teslimat kapsamı.", "logistics", ["central_admin", "admin", "seller", "courier"], { status: "integration_required", route: "/logistics/couriers", providerKey: "shipping_provider" }),
  capability("courier_management", "Kurye Yönetimi", "Kurye başvuru, rota, kazanç, belge ve performans.", "logistics", ["central_admin", "courier", "tenant_courier"], { route: "/logistics/couriers" }),
  capability("warehouses_stock", "Depo ve Stok", "Depo, raf, hareket, transfer ve stok sayımı.", "inventory", ["central_admin", "seller", "accounting"], { status: "provider_required", route: "/logistics/warehouses", providerKey: "erp_provider" }),
  capability("suppliers_purchasing", "Tedarikçi ve Satın Alma", "Tedarikçi, talep ve satın alma akışları.", "purchasing", ["central_admin", "accounting"], { status: "provider_required", route: "/erp/inventory", providerKey: "erp_provider" }),
  capability("crm", "CRM", "Müşteri ilişkileri ve satış sonrası takip.", "crm", ["central_admin", "support", "seller"], { status: "provider_required", route: "/erp/crm-hr-pos", providerKey: "erp_provider" }),
  capability("support_tickets", "Destek / Ticket", "Tenant, satıcı ve müşteri destek talepleri.", "support", ["central_admin", "support", "seller", "customer"], { route: "/support/tickets" }),
  capability("live_chat", "Canlı Chat", "Canlı destek ve ekip iletişim bağlantısı.", "support", ["central_admin", "support"], { status: "integration_required", route: "/support/chatbot", providerKey: "chat_provider" }),
  capability("notifications", "Bildirim", "Sipariş, sistem ve pazarlama bildirim şablonları.", "notifications", ["central_admin", "support", "tenant_admin"], { status: "integration_required", route: "/support/email", providerKey: "notification_provider" }),
  capability("sms", "SMS", "SMS sağlayıcı, şablon, doğrulama ve log kapsamı.", "notifications", ["central_admin", "support", "developer_api"], { status: "integration_required", route: "/support/sms", providerKey: "sms_provider" }),
  capability("email", "E-posta", "SMTP ve transactional e-posta kapsamı.", "notifications", ["central_admin", "support", "developer_api"], { status: "integration_required", route: "/support/email", providerKey: "email_provider" }),
  capability("whatsapp", "WhatsApp", "WhatsApp destek, sipariş ve otomasyon kapsamı.", "notifications", ["central_admin", "support", "developer_api"], { status: "integration_required", route: "/support/whatsapp", providerKey: "whatsapp_provider" }),
  capability("push_notifications", "Push", "Push ve uygulama bildirim kapsamı.", "notifications", ["central_admin", "support", "developer_api"], { status: "integration_required", route: "/support/push", providerKey: "push_provider" }),
  capability("two_factor_auth", "2FA", "İki adımlı doğrulama ve bildirim kanalları.", "security", ["central_admin", "admin", "customer", "tenant_admin"], { status: "integration_required", route: "/security/sessions", providerKey: "notification_provider" }),
  capability("marketing", "Pazarlama", "Pazarlama operasyonlarının üst kontrol alanı.", "marketing", ["central_admin", "ads", "seller"], { route: "/marketing/campaigns" }),
  capability("coupons", "Kupon", "Ürün, kategori, sadakat ve ilk alışveriş kuponları.", "marketing", ["central_admin", "ads", "seller"], { route: "/marketing/coupons" }),
  capability("campaigns", "Kampanya", "Sepet, kategori ve zamanlanmış kampanya kapsamı.", "marketing", ["central_admin", "ads", "seller"], { route: "/marketing/campaigns" }),
  capability("flash_sale", "Flash Sale", "Flash sale sayfası, ürün, stok ve sayaç kapsamı.", "marketing", ["central_admin", "ads", "seller"], { route: "/marketing/flash-sales" }),
  capability("auctions", "Müzayede", "Teklif, kazanan, ödeme ve komisyon kapsamı.", "auctions", ["central_admin", "seller", "customer"], { route: "/marketing/auctions" }),
  capability("affiliate", "Affiliate", "Referans, partner, komisyon ve ödeme kapsamı.", "marketing", ["central_admin", "ads", "seller", "customer"], { route: "/marketing/affiliate" }),
  capability("advertising", "Reklam", "Sponsorlu ürün, mağaza, banner ve bütçe kapsamı.", "marketing", ["central_admin", "ads", "seller"], { route: "/marketing/ads" }),
  capability("stories", "Story / Hikaye", "Mağaza, kampanya ve günlük hikaye akışları.", "marketing", ["central_admin", "ads", "seller"], { route: "/marketing/stories" }),
  capability("loyalty_points", "Sadakat ve Puan", "Puan, seviye, cashback ve VIP kapsamı.", "marketing", ["central_admin", "seller", "customer"], { route: "/marketing/loyalty" }),
  capability("cms", "CMS", "Sayfa, landing, policy, popup ve yardım merkezi.", "cms", ["central_admin", "design", "tenant_admin"], { route: "/cms/pages" }),
  capability("blog", "Blog", "Blog yazısı, kategori ve etiket kapsamı.", "cms", ["central_admin", "design", "seller"], { route: "/cms/blog" }),
  capability("seo_geo", "SEO / GEO", "Meta, sitemap, hreflang ve bölgesel landing kapsamı.", "cms", ["central_admin", "design", "seller"], { route: "/cms/seo" }),
  capability("theme_management", "Tema Yönetimi", "Tema kataloğu ve tenant tema atama yaşam döngüsü.", "themes", ["central_admin", "design", "tenant_admin"], { status: "runtime_ready", route: "/design/themes" }),
  capability("industry_theme_manifest", "90 Sektör Tema", "Gerçek kayıt olarak seed edilmiş sektör tema manifesti.", "themes", ["central_admin", "design", "tenant_admin"], { status: "runtime_ready", route: "/design/themes" }),
  capability("storefront_builder", "Storefront Builder", "Sayfa, header, footer, widget ve kanal düzeni.", "storefront_builder", ["central_admin", "design", "tenant_admin"], { route: "/design/builder" }),
  capability("tenant_storefront", "Tenant Storefront", "Tenant storefront yayınlama ve kanal deneyimi.", "storefront_builder", ["central_admin", "design", "tenant_admin"], { route: "/design/channels" }),
  capability("marketplace_front", "Marketplace Front", "Marketplace ana vitrin ve kanal deneyimi.", "storefront_builder", ["central_admin", "design"], { route: "/design/channels" }),
  capability("media_library", "Media Library", "Görsel, banner ve storefront medya kapsamı.", "media", ["central_admin", "design", "seller"], { status: "integration_required", route: "/design/media", providerKey: "storage_provider" }),
  capability("rich_media", "Dosya / Video / 3D Medya", "Dosya, video ve 3D varlık yönetimi.", "media", ["central_admin", "design", "seller"], { status: "integration_required", route: "/design/media", providerKey: "storage_provider" }),
  capability("module_registry", "Modül Registry", "Gerçek modül kayıtları, enable/disable ve event geçmişi.", "modules", ["central_admin", "developer_api"], { status: "runtime_ready", route: "/modules" }),
  capability("plugin_registry", "Plugin Registry", "Gerçek plugin kayıtları, aktivasyon ve event geçmişi.", "plugins", ["central_admin", "developer_api"], { status: "runtime_ready", route: "/modules/plugins" }),
  capability("module_plugin_licenses", "Modül ve Plugin Lisansları", "Market, paket ve özel uzantılar için lisans inceleme alanı.", "modules", ["central_admin", "developer_api"], { status: "license_review_required", route: "/modules/licenses" }),
  capability("theme_registry", "Theme Registry", "Gerçek tema kayıtları ve tenant assignment.", "themes", ["central_admin", "design"], { status: "runtime_ready", route: "/design/themes" }),
  capability("theme_licenses", "Tema Lisansları", "Tema marketi, güncelleme ve tenant kullanım hakkı incelemesi.", "themes", ["central_admin", "design", "tenant_admin"], { status: "license_review_required", route: "/licensing/theme-licenses" }),
  capability("integration_vault", "Integration Vault", "Şifreli credential ve provider resilience politikaları.", "integrations", ["central_admin", "developer_api"], { status: "runtime_ready", route: "/settings/integrations" }),
  capability("api_keys", "API Key", "API anahtarları ve scope denetimi.", "integrations", ["central_admin", "developer_api"], { route: "/integrations/api-keys" }),
  capability("webhooks", "Webhook", "Webhook endpoint, imza, retry ve event mapping.", "integrations", ["central_admin", "developer_api"], { route: "/integrations/webhooks" }),
  capability("import_export", "Import / Export", "Tenant, katalog ve rapor aktarım akışları.", "data_ops", ["central_admin", "admin", "developer_api"], { route: "/data-ops/imports" }),
  capability("xml_csv", "XML / CSV", "XML ve CSV aktarım şablonları.", "data_ops", ["central_admin", "seller", "developer_api"], { route: "/catalog/bulk-transfer" }),
  capability("backup_restore", "Backup / Restore", "Tenant ve sistem yedekleme operasyonları.", "backup", ["central_admin", "admin", "developer_api"], { route: "/system/backup-restore" }),
  capability("reports", "Raporlama", "Global, satış, finans ve marketplace raporları.", "reports", ["central_admin", "finance", "accounting", "ads"], { route: "/reports" }),
  capability("analytics", "Analytics", "Operasyon analitiği ve performans görünürlüğü.", "analytics", ["central_admin", "finance", "ads"], { route: "/reports/global" }),
  capability("fraud_risk", "Fraud / Risk", "Ödeme, sipariş ve hesap risk kuralları.", "security", ["central_admin", "admin", "finance"], { route: "/security/fraud" }),
  capability("audit_security", "Audit / Security", "Auth, provisioning ve operasyon audit görünürlüğü.", "security", ["central_admin", "admin", "developer_api"], { status: "runtime_ready", route: "/audit" }),
  capability("system_health", "Sistem Sağlığı", "Gateway health matrix ve servis görünürlüğü.", "platform", ["central_admin", "developer_api"], { status: "runtime_ready", route: "/platform/health" }),
  capability("demo_mode", "Demo Mode", "Etiketli demo lifecycle seed ve güvenli cleanup.", "platform", ["central_admin"], { status: "runtime_ready", route: "/settings/demo" }),
  capability("workspace_os", "Workspace OS", "Panel workspace deneyimi ve görev yüzeyleri.", "workspace_os", ["central_admin", "admin", "tenant_admin"], { route: "/blueprints" }),
  capability("context_menus", "Sağ Tık Menüleri", "Workspace bağlama göre işlem menüleri.", "workspace_os", ["central_admin", "admin", "tenant_admin"], { route: "/blueprints" }),
  capability("widgets", "Widget Sistemi", "Panel ve storefront widget katalogları.", "workspace_os", ["central_admin", "design", "tenant_admin"], { route: "/design/builder" }),
  capability("notification_drawer", "Bildirim Çekmecesi", "Workspace bildirim çekmecesi.", "workspace_os", ["central_admin", "admin", "tenant_admin"], { route: "/blueprints" }),
  capability("statistics_drawer", "İstatistik Çekmecesi", "Workspace istatistik çekmecesi.", "workspace_os", ["central_admin", "admin", "tenant_admin"], { route: "/blueprints" }),
  capability("tasks_planning", "Görev / Planlama", "Görev, vardiya ve iç operasyon planlama.", "staff", ["central_admin", "admin", "tenant_admin"], { route: "/staff/tasks" }),
  capability("team_messaging", "Ekip Mesajlaşma", "Ekip içi mesajlaşma ve kanal kapsamı.", "workspace_os", ["central_admin", "admin", "tenant_admin", "support"], { status: "integration_required", route: "/blueprints", providerKey: "communication_provider" }),
  capability("meetings_calls", "Toplantı / Arama", "Toplantı ve dahili arama kapsamı.", "workspace_os", ["central_admin", "admin", "support"], { status: "integration_required", route: "/blueprints", providerKey: "communication_provider" }),
  capability("external_calls", "Şirket Numarasıyla Dış Arama", "SIP veya voice provider üzerinden dış arama.", "workspace_os", ["central_admin", "support"], { status: "integration_required", route: "/settings/integrations", providerKey: "voice_provider" }),
  capability("printing", "Yazdırma", "Fatura, etiket ve operasyon çıktısı.", "print_center", ["central_admin", "admin", "seller"], { route: "/blueprints" }),
  capability("mini_tools", "Mini Araçlar", "Workspace içi yardımcı araç kataloğu.", "workspace_os", ["central_admin", "admin", "tenant_admin"], { route: "/blueprints" })
] as const;

const emptyDistribution = (): Record<BlueprintStatus, number> => ({
  runtime_ready: 0,
  planned: 0,
  provider_required: 0,
  integration_required: 0,
  enterprise_risk: 0,
  license_review_required: 0,
  disabled: 0
});

function statusDistribution(panelKey: string) {
  const distribution = emptyDistribution();
  for (const item of capabilityBlueprints) {
    if (item.panelTargets.includes(panelKey)) distribution[item.status] += 1;
  }
  return distribution;
}

function panel(
  panelKey: string,
  panelName: string,
  routePrefix: string,
  audience: string,
  roleTargets: readonly string[],
  menuGroups: readonly string[],
  moduleBindings: readonly string[],
  permissionPrefix: string,
  tenantScope: PanelBlueprint["tenantScope"],
  sourceName: string,
  sourceAliases: readonly string[] = []
): PanelBlueprint {
  return {
    panelKey,
    panelName,
    routePrefix,
    audience,
    roleTargets,
    menuGroups,
    moduleBindings,
    statusDistribution: statusDistribution(panelKey),
    permissionPrefix,
    panelTarget: panelKey,
    tenantScope,
    providerScope: [...new Set(capabilityBlueprints.filter((item) => item.panelTargets.includes(panelKey)).flatMap((item) => item.providerKey ? [item.providerKey] : []))],
    metadata: {
      sourceName,
      sourceAliases,
      sourceInventoryRefs: [`PDF panel: ${sourceName}`, "PDF sayfa 2 panel özeti", "Sohbet: FAZ 13 panel projeksiyonu"]
    }
  };
}

export const panelBlueprints: readonly PanelBlueprint[] = [
  panel("central_admin", "Central Admin", "/blueprints", "Platform sahibi ve süper admin", ["super_admin", "platform_owner"], ["Komuta Merkezi", "Tenantlar", "Marketplace", "Commerce Core", "Provider Merkezleri", "Güvenlik", "Sistem"], ["platform", "tenants", "modules", "themes", "plugins", "integrations", "security"], "platform", "global", "super_admin"),
  panel("admin", "Admin Operasyon Paneli", "/admin", "Platform operasyon ekibi", ["admin", "saas_admin"], ["Dashboard", "Tenantlar", "Kullanıcılar", "Destek", "Raporlar"], ["tenants", "customers", "support", "reports"], "admin", "mixed", "saas_admin"),
  panel("seller", "Satıcı Paneli", "/seller", "Marketplace satıcısı", ["seller", "vendor_admin", "vendor"], ["Mağaza", "Ürünler", "Siparişler", "Kargo", "Finans", "Kampanya", "Tasarım"], ["marketplace", "catalog", "orders", "logistics", "finance", "marketing"], "seller", "mixed", "seller"),
  panel("customer", "Müşteri Paneli", "/account", "Marketplace müşterisi", ["customer"], ["Hesabım", "Siparişlerim", "Kargo", "Cüzdan", "Sadakat", "Destek"], ["customers", "orders", "logistics", "wallets", "support"], "customer", "mixed", "customer"),
  panel("courier", "Kurye Paneli", "/courier", "Global teslimat ekibi", ["courier", "delivery_admin"], ["Teslimatlar", "Harita ve Rota", "Kazançlar", "Belgeler", "Performans"], ["logistics", "wallets", "security"], "courier", "mixed", "courier"),
  panel("tenant_admin", "Tenant Admin Paneli", "/tenant-admin", "Tenant sahibi ve yöneticisi", ["saas_owner", "tenant_admin"], ["Mağaza Ayarları", "Kullanıcılar", "Veriler", "Modüller", "Temalar", "Faturalar"], ["tenants", "modules", "themes", "subscriptions"], "tenant", "tenant", "saas_user"),
  panel("tenant_customer", "Tenant Müşteri Paneli", "/tenant-account", "Tenant müşterisi", ["saas_customer"], ["Hesabım", "Siparişler", "Cüzdan", "Destek"], ["customers", "orders", "wallets", "support"], "tenant.customer", "tenant", "saas_customer"),
  panel("tenant_seller", "Tenant Satıcı Paneli", "/tenant-seller", "Tenant satıcısı", ["saas_seller", "tenant_vendor"], ["Mağaza", "Ürünler", "Siparişler", "Kargo", "Finans"], ["marketplace", "catalog", "orders", "logistics"], "tenant.seller", "tenant", "saas_seller"),
  panel("tenant_courier", "Tenant Kurye Paneli", "/tenant-courier", "Tenant teslimat ekibi", ["saas_courier", "tenant_courier"], ["Teslimatlar", "Rota", "Kazanç", "Belgeler"], ["logistics", "wallets", "security"], "tenant.courier", "tenant", "saas_courier"),
  panel("finance", "Finans Paneli", "/finance", "Finans operasyon ekibi", ["finance_admin", "super_admin"], ["Gelirler", "Ödemeler", "Cüzdanlar", "Payout", "Komisyon", "Raporlar"], ["payments", "wallets", "finance", "reports"], "finance", "mixed", "finance"),
  panel("accounting", "Muhasebe Paneli", "/accounting", "Muhasebe ve vergi ekibi", ["accounting_admin", "finance_admin"], ["Muhasebe", "Vergi", "Fatura", "ERP", "Raporlar"], ["accounting", "tax", "invoicing", "erp"], "accounting", "mixed", "accounting"),
  panel("ads", "Reklam Paneli", "/ads", "Reklam ve kampanya ekibi", ["ads_admin", "advertiser", "saas_ads_admin"], ["Kampanyalar", "Reklam Alanları", "Hedefleme", "Bütçe", "Raporlar"], ["marketing", "analytics"], "ads", "mixed", "ads", ["saas_ads"]),
  panel("design", "Tasarım Paneli", "/design", "Tema ve storefront ekibi", ["designer", "tenant_admin", "saas_designer"], ["Temalar", "Builder", "Widgetler", "Mobil", "SEO / GEO", "Medya"], ["themes", "storefront_builder", "cms", "media"], "design", "mixed", "design", ["saas_design"]),
  panel("support", "Destek Paneli", "/support", "Destek ve iletişim ekibi", ["support_admin", "support_agent"], ["Ticketlar", "Canlı Chat", "Bildirim", "SMS", "E-posta", "WhatsApp"], ["support", "notifications"], "support", "mixed", "super_admin:Destek/Ticket"),
  panel("developer_api", "Developer / API Paneli", "/developer", "API, provider ve entegrasyon ekibi", ["developer", "integration_admin"], ["API Anahtarları", "Webhooklar", "Providerlar", "Import / Export", "Sistem Sağlığı"], ["integrations", "data_ops", "platform"], "developer", "mixed", "super_admin:API Yönetimi")
] as const;

export const blueprintStatusLabels: Readonly<Record<BlueprintStatus, string>> = {
  runtime_ready: "Runtime hazır",
  planned: "Planlandı",
  provider_required: "Provider gerekli",
  integration_required: "Entegrasyon gerekli",
  enterprise_risk: "Enterprise riski",
  license_review_required: "Lisans incelemesi",
  disabled: "Kapalı"
};

export const providerBlueprints = [...new Set(capabilityBlueprints.flatMap((item) => item.providerKey ? [item.providerKey] : []))]
  .map((providerKey) => ({
    providerKey,
    capabilityCount: capabilityBlueprints.filter((item) => item.providerKey === providerKey).length,
    capabilities: capabilityBlueprints.filter((item) => item.providerKey === providerKey).map((item) => item.label)
  }));

export const blueprintStats = {
  ...pdfInventorySummary,
  operationalPanelCount: panelBlueprints.length,
  indexedCapabilityCount: capabilityBlueprints.length,
  providerCount: providerBlueprints.length,
  statusDistribution: capabilityBlueprints.reduce((distribution, item) => {
    distribution[item.status] += 1;
    return distribution;
  }, emptyDistribution())
} as const;

export interface BlueprintSearchLink {
  readonly label: string;
  readonly href: string;
  readonly description: string;
  readonly panelLabel?: string;
  readonly status?: BlueprintStatus;
  readonly provider?: string;
  readonly permission?: string;
  readonly searchText?: string;
}

export const searchableBlueprintLinks: readonly BlueprintSearchLink[] = [
  ...panelBlueprints.map((item) => ({
    label: item.panelName,
    href: `/blueprints#panel-${item.panelKey}`,
    description: `${item.audience}. ${item.menuGroups.join(", ")}`,
    panelLabel: item.panelName,
    status: "planned" as const,
    permission: `${item.permissionPrefix}.*`,
    searchText: `${item.panelKey} ${item.metadata.sourceName} ${item.metadata.sourceAliases.join(" ")}`
  })),
  ...capabilityBlueprints.map((item) => ({
    label: item.label,
    href: item.route ?? `/blueprints#capability-${item.key}`,
    description: item.description,
    panelLabel: item.panelTargets.join(", "),
    status: item.status,
    ...(item.providerKey ? { provider: item.providerKey } : {}),
    permission: `${item.permissionPrefix}.*`,
    searchText: `${item.key} ${item.moduleKey} ${item.tags.join(" ")}`
  }))
] as const;

export function assertPanelBlueprintCoverage() {
  const sourceTotals = pdfSourcePanels.reduce(
    (totals, panelItem) => ({
      menuGroups: totals.menuGroups + panelItem.menuGroupCount,
      menuItems: totals.menuItems + panelItem.menuItemCount,
      permissions: totals.permissions + panelItem.permissionCount
    }),
    { menuGroups: 0, menuItems: 0, permissions: 0 }
  );
  const panelKeys = panelBlueprints.map((item) => item.panelKey);
  const capabilityKeys = capabilityBlueprints.map((item) => item.key);

  if (pdfSourcePanels.length !== pdfInventorySummary.panelCount) throw new Error("PDF source panel count mismatch");
  if (sourceTotals.menuGroups !== pdfInventorySummary.menuGroupCount) throw new Error("PDF menu group count mismatch");
  if (sourceTotals.menuItems !== pdfInventorySummary.menuItemCount) throw new Error("PDF menu item count mismatch");
  if (sourceTotals.permissions !== pdfInventorySummary.permissionCount) throw new Error("PDF permission count mismatch");
  if (panelBlueprints.length !== 15) throw new Error("Operational panel projection must contain 15 panels");
  if (new Set(panelKeys).size !== panelKeys.length) throw new Error("Duplicate operational panel key");
  if (new Set(capabilityKeys).size !== capabilityKeys.length) throw new Error("Duplicate capability blueprint key");
}

assertPanelBlueprintCoverage();
