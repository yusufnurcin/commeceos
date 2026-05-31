import { createHash, pbkdf2Sync, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import pg from "pg";
import type { PoolClient } from "pg";

const { Pool } = pg;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const directOnly = process.argv.includes("--direct") || process.env.COMMERCE_OS_BOOTSTRAP_IN_CONTAINER === "1";

const coreModules = [
  {
    key: "tenants",
    name: "Tenant Yönetimi",
    description: "Tenant registry, workspace provisioning ve tenant yaşam döngüsü.",
    category: "platform",
    enabled: true,
    dependencies: [],
    capabilities: ["tenant.registry", "tenant.provisioning", "workspace.registry"]
  },
  {
    key: "marketplace",
    name: "Marketplace",
    description: "Satıcı ekosistemi, mağaza denetimi ve marketplace operasyonları.",
    category: "marketplace",
    enabled: false,
    dependencies: ["tenants"],
    capabilities: ["seller.registry", "marketplace.governance"]
  },
  {
    key: "seller_kyc",
    name: "Satıcı KYC",
    description: "Satıcı belge, kimlik ve uygunluk denetimi.",
    category: "marketplace",
    enabled: false,
    dependencies: ["marketplace", "security"],
    capabilities: ["seller.kyc", "document.review"]
  },
  {
    key: "catalog",
    name: "Katalog",
    description: "Ürün, kategori, varyant ve attribute yönetimi.",
    category: "commerce",
    enabled: false,
    dependencies: ["medusa_commerce"],
    capabilities: ["catalog.products", "catalog.categories", "catalog.import"]
  },
  {
    key: "orders",
    name: "Siparişler",
    description: "Sipariş, iade, iptal ve fraud operasyonları.",
    category: "commerce",
    enabled: false,
    dependencies: ["medusa_commerce"],
    capabilities: ["orders.global", "returns", "refunds"]
  },
  {
    key: "payments",
    name: "Ödemeler",
    description: "Ödeme sağlayıcıları ve ödeme akışı ayarları.",
    category: "finance",
    enabled: false,
    dependencies: ["tenants"],
    capabilities: ["payments.providers", "payments.capture"]
  },
  {
    key: "wallets",
    name: "Cüzdanlar",
    description: "Satıcı, tenant, müşteri ve kurye bakiye yönetimi.",
    category: "finance",
    enabled: false,
    dependencies: ["payments"],
    capabilities: ["wallets.balance", "payouts.queue"]
  },
  {
    key: "accounting",
    name: "Muhasebe",
    description: "Muhasebe mapping, cari hesaplar ve Odoo accounting bağlantısı.",
    category: "accounting",
    enabled: false,
    dependencies: ["erp_odoo"],
    capabilities: ["accounting.mapping", "accounting.reports"]
  },
  {
    key: "tax",
    name: "Vergi",
    description: "Vergi oranları, vergi rejimleri ve bölgesel vergi kuralları.",
    category: "accounting",
    enabled: false,
    dependencies: ["accounting"],
    capabilities: ["tax.rules", "tax.regimes"]
  },
  {
    key: "invoicing",
    name: "Fatura",
    description: "Fatura merkezi ve muhasebe belge akışı.",
    category: "accounting",
    enabled: false,
    dependencies: ["accounting", "tax"],
    capabilities: ["invoices.issue", "invoices.sync"]
  },
  {
    key: "erp_odoo",
    name: "ERP / Odoo",
    description: "Odoo engine health, bridge jobs ve ERP bağlantı merkezi.",
    category: "erp",
    enabled: true,
    dependencies: ["tenants"],
    capabilities: ["odoo.health", "odoo.bridge_jobs"]
  },
  {
    key: "medusa_commerce",
    name: "Medusa Commerce",
    description: "Medusa health, orchestration jobs ve commerce engine bağlantısı.",
    category: "commerce",
    enabled: true,
    dependencies: ["tenants"],
    capabilities: ["medusa.health", "medusa.orchestration_jobs"]
  },
  {
    key: "logistics",
    name: "Lojistik",
    description: "Kargo, kurye, depo ve teslimat operasyonları.",
    category: "operations",
    enabled: false,
    dependencies: ["orders"],
    capabilities: ["shipments", "couriers", "warehouses"]
  },
  {
    key: "support",
    name: "Destek",
    description: "Ticket, canlı destek ve destek kanalları.",
    category: "support",
    enabled: false,
    dependencies: ["notifications"],
    capabilities: ["tickets", "support.channels"]
  },
  {
    key: "notifications",
    name: "Bildirimler",
    description: "E-posta, SMS, WhatsApp ve push bildirim hazırlığı.",
    category: "communications",
    enabled: false,
    dependencies: ["tenants"],
    capabilities: ["email", "sms", "whatsapp", "push"]
  },
  {
    key: "marketing",
    name: "Pazarlama",
    description: "Kampanya, kupon, reklam, loyalty ve affiliate operasyonları.",
    category: "growth",
    enabled: false,
    dependencies: [],
    capabilities: ["campaigns", "coupons", "ads", "loyalty"]
  },
  {
    key: "storefront_builder",
    name: "Storefront Builder",
    description: "Tema, sayfa, blok ve storefront düzenleme altyapısı.",
    category: "design",
    enabled: false,
    dependencies: ["themes"],
    capabilities: ["storefront.pages", "builder.blocks"]
  },
  {
    key: "cms",
    name: "CMS",
    description: "Sayfa, içerik, medya, SEO ve yayınlama altyapısı.",
    category: "content",
    enabled: false,
    dependencies: ["storefront_builder"],
    capabilities: ["cms.pages", "seo"]
  },
  {
    key: "ai",
    name: "AI Operasyonları",
    description: "AI sinyal, öneri ve operasyon yardımcı altyapısı.",
    category: "ai",
    enabled: true,
    dependencies: ["tenants"],
    capabilities: ["ai.signals", "ai.operations"]
  },
  {
    key: "security",
    name: "Güvenlik",
    description: "Rol, yetki, oturum, audit ve güvenlik denetimi.",
    category: "security",
    enabled: true,
    dependencies: [],
    capabilities: ["roles", "permissions", "sessions", "audit"]
  },
  {
    key: "integrations",
    name: "Entegrasyonlar",
    description: "API keys, webhooklar ve dış servis bağlantıları.",
    category: "integrations",
    enabled: false,
    dependencies: ["security"],
    capabilities: ["api_keys", "webhooks"]
  },
  {
    key: "reports",
    name: "Raporlama",
    description: "Operasyon, satış, finans ve sistem raporları.",
    category: "analytics",
    enabled: false,
    dependencies: ["tenants"],
    capabilities: ["reports.global", "exports"]
  },
  {
    key: "backup",
    name: "Yedekleme",
    description: "Tenant ve platform backup/restore operasyonları.",
    category: "system",
    enabled: false,
    dependencies: ["tenants"],
    capabilities: ["backup", "restore"]
  },
  {
    key: "localization",
    name: "Yerelleştirme",
    description: "Ülke, dil, para birimi, timezone ve bölgesel ayarlar.",
    category: "platform",
    enabled: true,
    dependencies: ["tenants"],
    capabilities: ["countries", "currencies", "languages"]
  },
  {
    key: "themes",
    name: "Temalar",
    description: "Tema registry, tema seçimi ve tenant tema hazırlığı.",
    category: "design",
    enabled: false,
    dependencies: [],
    capabilities: ["theme.registry", "theme.assignment"]
  },
  {
    key: "plugins",
    name: "Pluginler",
    description: "Plugin registry, upload, activation ve extension noktaları.",
    category: "extensions",
    enabled: false,
    dependencies: ["integrations"],
    capabilities: ["plugin.registry", "plugin.activation"]
  }
] as const;

const coreThemeSeeds = [
  { key: "moda", name: "Moda", industry: "Moda", category: "retail", capabilities: ["catalog", "variants", "lookbook"], requiredModules: ["themes", "catalog"] },
  { key: "elektronik", name: "Elektronik", industry: "Elektronik", category: "retail", capabilities: ["catalog", "comparison", "warranty"], requiredModules: ["themes", "catalog"] },
  { key: "market", name: "Market", industry: "Market", category: "grocery", capabilities: ["catalog", "fast-delivery", "inventory"], requiredModules: ["themes", "catalog", "logistics"] },
  { key: "restoran", name: "Restoran", industry: "Restoran", category: "food", capabilities: ["menu", "delivery", "reservation"], requiredModules: ["themes", "catalog", "orders"] },
  { key: "kafe", name: "Kafe", industry: "Kafe", category: "food", capabilities: ["menu", "pickup", "loyalty"], requiredModules: ["themes", "catalog"] },
  { key: "kozmetik", name: "Kozmetik", industry: "Kozmetik", category: "retail", capabilities: ["catalog", "bundles", "beauty-guides"], requiredModules: ["themes", "catalog"] },
  { key: "mobilya", name: "Mobilya", industry: "Mobilya", category: "home", capabilities: ["catalog", "room-sets", "delivery-slots"], requiredModules: ["themes", "catalog", "logistics"] },
  { key: "yapi_market", name: "Yapı Market", industry: "Yapı Market", category: "home", capabilities: ["catalog", "bulk-order", "warehouse"], requiredModules: ["themes", "catalog", "logistics"] },
  { key: "otomotiv", name: "Otomotiv", industry: "Otomotiv", category: "automotive", capabilities: ["catalog", "lead-form", "service-booking"], requiredModules: ["themes", "catalog"] },
  { key: "yedek_parca", name: "Yedek Parça", industry: "Yedek Parça", category: "automotive", capabilities: ["fitment", "catalog", "inventory"], requiredModules: ["themes", "catalog"] },
  { key: "kitap", name: "Kitap", industry: "Kitap", category: "media", capabilities: ["catalog", "author-pages", "isbn"], requiredModules: ["themes", "catalog"] },
  { key: "muzik", name: "Müzik", industry: "Müzik", category: "media", capabilities: ["catalog", "artist-pages", "digital-preview"], requiredModules: ["themes", "catalog"] },
  { key: "sanatci_solist", name: "Sanatçı / Solist", industry: "Sanatçı / Solist", category: "media", capabilities: ["portfolio", "events", "booking"], requiredModules: ["themes", "cms"] },
  { key: "egitim", name: "Eğitim", industry: "Eğitim", category: "education", capabilities: ["course-catalog", "applications", "content"], requiredModules: ["themes", "cms"] },
  { key: "kurs", name: "Kurs", industry: "Kurs", category: "education", capabilities: ["course-catalog", "calendar", "booking"], requiredModules: ["themes", "cms"] },
  { key: "saglik", name: "Sağlık", industry: "Sağlık", category: "health", capabilities: ["services", "appointment", "compliance-copy"], requiredModules: ["themes", "cms"] },
  { key: "medikal", name: "Medikal", industry: "Medikal", category: "health", capabilities: ["catalog", "certificates", "b2b-request"], requiredModules: ["themes", "catalog"] },
  { key: "eczane", name: "Eczane", industry: "Eczane", category: "health", capabilities: ["catalog", "prescription-note", "local-delivery"], requiredModules: ["themes", "catalog", "logistics"] },
  { key: "spor", name: "Spor", industry: "Spor", category: "retail", capabilities: ["catalog", "teams", "training-content"], requiredModules: ["themes", "catalog"] },
  { key: "supplement", name: "Supplement", industry: "Supplement", category: "health", capabilities: ["catalog", "subscriptions", "bundle-builder"], requiredModules: ["themes", "catalog"] },
  { key: "kuyum", name: "Kuyum", industry: "Kuyum", category: "luxury", capabilities: ["catalog", "certificate", "appointment"], requiredModules: ["themes", "catalog"] },
  { key: "cicek", name: "Çiçek", industry: "Çiçek", category: "gifts", capabilities: ["catalog", "same-day-delivery", "occasion-filter"], requiredModules: ["themes", "catalog", "logistics"] },
  { key: "petshop", name: "Petshop", industry: "Petshop", category: "retail", capabilities: ["catalog", "subscriptions", "pet-profile"], requiredModules: ["themes", "catalog"] },
  { key: "bebek", name: "Bebek", industry: "Bebek", category: "retail", capabilities: ["catalog", "age-filter", "gift-registry"], requiredModules: ["themes", "catalog"] },
  { key: "oyuncak", name: "Oyuncak", industry: "Oyuncak", category: "retail", capabilities: ["catalog", "age-filter", "safety-badges"], requiredModules: ["themes", "catalog"] },
  { key: "dijital_urun", name: "Dijital Ürün", industry: "Dijital Ürün", category: "digital", capabilities: ["digital-delivery", "license", "download"], requiredModules: ["themes", "catalog"] },
  { key: "yazilim", name: "Yazılım", industry: "Yazılım", category: "digital", capabilities: ["plans", "docs", "license"], requiredModules: ["themes", "cms"] },
  { key: "saas", name: "SaaS", industry: "SaaS", category: "digital", capabilities: ["plans", "trial", "feature-grid"], requiredModules: ["themes", "cms"] },
  { key: "otel", name: "Otel", industry: "Otel", category: "travel", capabilities: ["rooms", "booking", "amenities"], requiredModules: ["themes", "cms"] },
  { key: "turizm", name: "Turizm", industry: "Turizm", category: "travel", capabilities: ["tour-packages", "booking", "itinerary"], requiredModules: ["themes", "cms"] },
  { key: "emlak", name: "Emlak", industry: "Emlak", category: "real-estate", capabilities: ["listings", "lead-form", "map"], requiredModules: ["themes", "cms"] },
  { key: "arac_kiralama", name: "Araç Kiralama", industry: "Araç Kiralama", category: "automotive", capabilities: ["availability", "booking", "fleet"], requiredModules: ["themes", "cms"] },
  { key: "etkinlik", name: "Etkinlik", industry: "Etkinlik", category: "events", capabilities: ["event-calendar", "registration", "sponsors"], requiredModules: ["themes", "cms"] },
  { key: "bilet", name: "Bilet", industry: "Bilet", category: "events", capabilities: ["ticketing", "seat-map", "check-in"], requiredModules: ["themes", "orders"] },
  { key: "hizmet_pazari", name: "Hizmet Pazarı", industry: "Hizmet Pazarı", category: "marketplace", capabilities: ["providers", "booking", "reviews"], requiredModules: ["themes", "marketplace"] },
  { key: "kuafor", name: "Kuaför", industry: "Kuaför", category: "services", capabilities: ["services", "appointment", "staff"], requiredModules: ["themes", "cms"] },
  { key: "guzellik_salonu", name: "Güzellik Salonu", industry: "Güzellik Salonu", category: "services", capabilities: ["services", "appointment", "packages"], requiredModules: ["themes", "cms"] },
  { key: "klinik", name: "Klinik", industry: "Klinik", category: "health", capabilities: ["services", "appointment", "team"], requiredModules: ["themes", "cms"] },
  { key: "hukuk", name: "Hukuk", industry: "Hukuk", category: "professional", capabilities: ["services", "case-intake", "team"], requiredModules: ["themes", "cms"] },
  { key: "muhasebe", name: "Muhasebe", industry: "Muhasebe", category: "professional", capabilities: ["services", "consultation", "document-intake"], requiredModules: ["themes", "cms"] },
  { key: "danismanlik", name: "Danışmanlık", industry: "Danışmanlık", category: "professional", capabilities: ["services", "booking", "case-studies"], requiredModules: ["themes", "cms"] },
  { key: "tarim", name: "Tarım", industry: "Tarım", category: "b2b", capabilities: ["catalog", "seasonal", "quote-request"], requiredModules: ["themes", "catalog"] },
  { key: "gida_uretici", name: "Gıda Üretici", industry: "Gıda Üretici", category: "b2b", capabilities: ["catalog", "certificates", "b2b-order"], requiredModules: ["themes", "catalog"] },
  { key: "toptan_b2b", name: "Toptan / B2B", industry: "Toptan / B2B", category: "b2b", capabilities: ["bulk-order", "quote-request", "company-accounts"], requiredModules: ["themes", "catalog"] },
  { key: "dropshipping", name: "Dropshipping", industry: "Dropshipping", category: "marketplace", capabilities: ["supplier-catalog", "sync", "fulfillment"], requiredModules: ["themes", "catalog", "integrations"] },
  { key: "marketplace_genel", name: "Marketplace Genel", industry: "Marketplace Genel", category: "marketplace", capabilities: ["seller-stores", "multi-vendor", "commission"], requiredModules: ["themes", "marketplace"] },
  { key: "sanat_galeri", name: "Sanat / Galeri", industry: "Sanat / Galeri", category: "media", capabilities: ["portfolio", "artist-pages", "inquiry"], requiredModules: ["themes", "cms"] },
  { key: "sinema_medya", name: "Sinema / Medya", industry: "Sinema / Medya", category: "media", capabilities: ["catalog", "showcase", "screening"], requiredModules: ["themes", "cms"] },
  { key: "influencer", name: "Influencer", industry: "Influencer", category: "media", capabilities: ["profile", "media-kit", "shop"], requiredModules: ["themes", "cms"] },
  { key: "bagis_stk", name: "Bağış / STK", industry: "Bağış / STK", category: "nonprofit", capabilities: ["donation", "campaigns", "impact"], requiredModules: ["themes", "cms"] },
  { key: "belediye_kurum", name: "Belediye / Kurum", industry: "Belediye / Kurum", category: "public", capabilities: ["announcements", "services", "forms"], requiredModules: ["themes", "cms"] },
  { key: "lojistik", name: "Lojistik", industry: "Lojistik", category: "operations", capabilities: ["service-map", "quote-request", "tracking"], requiredModules: ["themes", "logistics"] },
  { key: "kurye", name: "Kurye", industry: "Kurye", category: "operations", capabilities: ["delivery-zones", "tracking", "quote-request"], requiredModules: ["themes", "logistics"] },
  { key: "depo", name: "Depo", industry: "Depo", category: "operations", capabilities: ["warehouse", "capacity", "b2b-intake"], requiredModules: ["themes", "logistics"] },
  { key: "uretim", name: "Üretim", industry: "Üretim", category: "industrial", capabilities: ["capabilities", "quote-request", "certificates"], requiredModules: ["themes", "cms"] },
  { key: "tekstil", name: "Tekstil", industry: "Tekstil", category: "industrial", capabilities: ["catalog", "b2b-order", "samples"], requiredModules: ["themes", "catalog"] },
  { key: "ayakkabi", name: "Ayakkabı", industry: "Ayakkabı", category: "retail", capabilities: ["catalog", "size-guide", "variants"], requiredModules: ["themes", "catalog"] },
  { key: "canta", name: "Çanta", industry: "Çanta", category: "retail", capabilities: ["catalog", "lookbook", "variants"], requiredModules: ["themes", "catalog"] },
  { key: "aksesuar", name: "Aksesuar", industry: "Aksesuar", category: "retail", capabilities: ["catalog", "bundles", "gift"], requiredModules: ["themes", "catalog"] },
  { key: "ev_yasam", name: "Ev Yaşam", industry: "Ev Yaşam", category: "home", capabilities: ["catalog", "room-sets", "inspiration"], requiredModules: ["themes", "catalog"] },
  { key: "hediyelik", name: "Hediyelik", industry: "Hediyelik", category: "gifts", capabilities: ["catalog", "occasion-filter", "gift-note"], requiredModules: ["themes", "catalog"] },
  { key: "dugun_organizasyon", name: "Düğün / Organizasyon", industry: "Düğün / Organizasyon", category: "events", capabilities: ["packages", "booking", "portfolio"], requiredModules: ["themes", "cms"] },
  { key: "fotografci", name: "Fotoğrafçı", industry: "Fotoğrafçı", category: "creative", capabilities: ["portfolio", "booking", "packages"], requiredModules: ["themes", "cms"] },
  { key: "matbaa", name: "Matbaa", industry: "Matbaa", category: "services", capabilities: ["quote-request", "product-options", "upload"], requiredModules: ["themes", "catalog"] },
  { key: "ajans", name: "Ajans", industry: "Ajans", category: "creative", capabilities: ["portfolio", "services", "lead-form"], requiredModules: ["themes", "cms"] },
  { key: "reklam", name: "Reklam", industry: "Reklam", category: "creative", capabilities: ["campaign-showcase", "services", "lead-form"], requiredModules: ["themes", "cms"] },
  { key: "oyun", name: "Oyun", industry: "Oyun", category: "digital", capabilities: ["digital-catalog", "community", "download"], requiredModules: ["themes", "catalog"] },
  { key: "hobi", name: "Hobi", industry: "Hobi", category: "retail", capabilities: ["catalog", "community", "guides"], requiredModules: ["themes", "catalog"] },
  { key: "outdoor", name: "Outdoor", industry: "Outdoor", category: "retail", capabilities: ["catalog", "activity-filter", "guides"], requiredModules: ["themes", "catalog"] },
  { key: "bisiklet", name: "Bisiklet", industry: "Bisiklet", category: "retail", capabilities: ["catalog", "service-booking", "fit-guide"], requiredModules: ["themes", "catalog"] },
  { key: "denizcilik", name: "Denizcilik", industry: "Denizcilik", category: "industrial", capabilities: ["catalog", "quote-request", "service"], requiredModules: ["themes", "catalog"] },
  { key: "sanayi", name: "Sanayi", industry: "Sanayi", category: "industrial", capabilities: ["b2b-catalog", "quote-request", "certificates"], requiredModules: ["themes", "catalog"] },
  { key: "makine", name: "Makine", industry: "Makine", category: "industrial", capabilities: ["b2b-catalog", "spec-sheets", "quote-request"], requiredModules: ["themes", "catalog"] },
  { key: "elektrik", name: "Elektrik", industry: "Elektrik", category: "industrial", capabilities: ["catalog", "spec-sheets", "quote-request"], requiredModules: ["themes", "catalog"] },
  { key: "guvenlik_sistemleri", name: "Güvenlik Sistemleri", industry: "Güvenlik Sistemleri", category: "services", capabilities: ["catalog", "service-plans", "quote-request"], requiredModules: ["themes", "catalog"] },
  { key: "temizlik", name: "Temizlik", industry: "Temizlik", category: "services", capabilities: ["services", "booking", "subscriptions"], requiredModules: ["themes", "cms"] },
  { key: "ikinci_el", name: "İkinci El", industry: "İkinci El", category: "marketplace", capabilities: ["classifieds", "seller-profiles", "inspection"], requiredModules: ["themes", "marketplace"] },
  { key: "acik_artirma", name: "Açık Artırma", industry: "Açık Artırma", category: "marketplace", capabilities: ["auction", "bidding", "watchlist"], requiredModules: ["themes", "marketplace"] },
  { key: "abonelik_kutusu", name: "Abonelik Kutusu", industry: "Abonelik Kutusu", category: "subscription", capabilities: ["plans", "recurring", "box-builder"], requiredModules: ["themes", "payments"] },
  { key: "premium_butik", name: "Premium Butik", industry: "Premium Butik", category: "luxury", capabilities: ["catalog", "lookbook", "appointment"], requiredModules: ["themes", "catalog"], isPremium: true },
  { key: "yerel_esnaf", name: "Yerel Esnaf", industry: "Yerel Esnaf", category: "local", capabilities: ["catalog", "local-delivery", "store-info"], requiredModules: ["themes", "catalog"] },
  { key: "global_export", name: "Global Export", industry: "Global Export", category: "b2b", capabilities: ["multi-currency", "quote-request", "export-docs"], requiredModules: ["themes", "localization", "catalog"] },
  { key: "cok_dilli_magaza", name: "Çok Dilli Mağaza", industry: "Çok Dilli Mağaza", category: "global", capabilities: ["multi-language", "multi-currency", "locale-routing"], requiredModules: ["themes", "localization"] },
  { key: "dijital_pazar", name: "Dijital Pazar", industry: "Dijital Pazar", category: "marketplace", capabilities: ["digital-catalog", "seller-stores", "download"], requiredModules: ["themes", "marketplace"] },
  { key: "hizli_teslimat", name: "Hızlı Teslimat", industry: "Hızlı Teslimat", category: "operations", capabilities: ["fast-delivery", "tracking", "zones"], requiredModules: ["themes", "logistics"] },
  { key: "super_app", name: "Süper App", industry: "Süper App", category: "platform", capabilities: ["multi-service", "wallet", "notifications"], requiredModules: ["themes", "payments", "notifications"] },
  { key: "tenant_default", name: "Tenant Default", industry: "Tenant Default", category: "default", capabilities: ["tenant-ready", "responsive", "starter-layout"], requiredModules: ["themes"] },
  { key: "enterprise_default", name: "Enterprise Default", industry: "Enterprise Default", category: "default", capabilities: ["enterprise", "governance", "multi-locale"], requiredModules: ["themes", "localization"] },
  { key: "minimal_default", name: "Minimal Default", industry: "Minimal Default", category: "default", capabilities: ["minimal", "responsive", "fast-start"], requiredModules: ["themes"] },
  { key: "luxury_default", name: "Luxury Default", industry: "Luxury Default", category: "default", capabilities: ["premium-layout", "lookbook", "appointment"], requiredModules: ["themes"], isPremium: true }
] as const;

const corePluginSeeds = [
  { key: "whatsapp_business", name: "WhatsApp Business", category: "communications", description: "WhatsApp Business mesajlaşma ve bildirim kanal manifesti.", requiredModules: ["plugins", "notifications", "integrations"], capabilities: ["whatsapp.messages", "templates", "delivery_status"], permissions: ["plugins.whatsapp.manage"] },
  { key: "smtp_email", name: "SMTP E-posta", category: "communications", description: "SMTP e-posta gönderim bağlantısı ve doğrulama ayarları.", requiredModules: ["plugins", "notifications"], capabilities: ["email.smtp", "transactional_email"], permissions: ["plugins.email.manage"] },
  { key: "sms_gateway", name: "SMS Gateway", category: "communications", description: "SMS sağlayıcı bağlantısı ve gönderim ayarları.", requiredModules: ["plugins", "notifications"], capabilities: ["sms.send", "delivery_status"], permissions: ["plugins.sms.manage"] },
  { key: "push_notifications", name: "Push Bildirimleri", category: "communications", description: "Web ve mobil push bildirim kanal manifesti.", requiredModules: ["plugins", "notifications"], capabilities: ["push.web", "push.mobile"], permissions: ["plugins.push.manage"] },
  { key: "stripe_payments", name: "Stripe Payments", category: "payments", description: "Stripe ödeme sağlayıcı bağlantısı ve ödeme akışı manifesti.", requiredModules: ["plugins", "payments"], capabilities: ["payments.stripe", "checkout", "webhooks"], permissions: ["plugins.payments.manage"] },
  { key: "iyzico_payments", name: "iyzico Payments", category: "payments", description: "iyzico ödeme sağlayıcı bağlantısı ve Türkiye ödeme akışı manifesti.", requiredModules: ["plugins", "payments", "localization"], capabilities: ["payments.iyzico", "installments", "webhooks"], permissions: ["plugins.payments.manage"] },
  { key: "paypal_payments", name: "PayPal Payments", category: "payments", description: "PayPal ödeme sağlayıcı bağlantısı ve global ödeme akışı manifesti.", requiredModules: ["plugins", "payments", "localization"], capabilities: ["payments.paypal", "checkout", "refunds"], permissions: ["plugins.payments.manage"] },
  { key: "cargo_provider", name: "Kargo Sağlayıcı", category: "logistics", description: "Kargo sağlayıcı entegrasyonu, takip ve teslimat durum manifesti.", requiredModules: ["plugins", "logistics"], capabilities: ["cargo.labels", "shipment_tracking"], permissions: ["plugins.logistics.manage"] },
  { key: "invoice_export", name: "Fatura Export", category: "accounting", description: "Fatura dışa aktarım ve muhasebe belge akışı manifesti.", requiredModules: ["plugins", "invoicing", "accounting"], capabilities: ["invoice.export", "accounting.documents"], permissions: ["plugins.accounting.manage"] },
  { key: "xml_importer", name: "XML Importer", category: "catalog", description: "XML ürün içe aktarım bağlantısı ve şema mapping manifesti.", requiredModules: ["plugins", "catalog"], capabilities: ["catalog.xml_import", "mapping"], permissions: ["plugins.catalog.manage"] },
  { key: "csv_importer", name: "CSV Importer", category: "catalog", description: "CSV ürün içe aktarım bağlantısı ve kolon mapping manifesti.", requiredModules: ["plugins", "catalog"], capabilities: ["catalog.csv_import", "mapping"], permissions: ["plugins.catalog.manage"] },
  { key: "product_feed_google", name: "Google Product Feed", category: "marketing", description: "Google ürün feed çıkışı ve katalog dağıtım manifesti.", requiredModules: ["plugins", "catalog", "marketing"], capabilities: ["feeds.google", "merchant_center"], permissions: ["plugins.feed.manage"] },
  { key: "product_feed_meta", name: "Meta Product Feed", category: "marketing", description: "Meta ürün feed çıkışı ve reklam katalog manifesti.", requiredModules: ["plugins", "catalog", "marketing"], capabilities: ["feeds.meta", "catalog_ads"], permissions: ["plugins.feed.manage"] },
  { key: "analytics_connector", name: "Analytics Connector", category: "analytics", description: "Analytics event çıkışı ve raporlama bağlantı manifesti.", requiredModules: ["plugins", "reports"], capabilities: ["analytics.events", "reports.export"], permissions: ["plugins.analytics.manage"] },
  { key: "ai_content_assistant", name: "AI İçerik Asistanı", category: "ai", description: "AI destekli içerik üretim ve operasyon yardımcısı manifesti.", requiredModules: ["plugins", "ai", "cms"], capabilities: ["ai.content", "cms.assist"], permissions: ["plugins.ai.manage"] },
  { key: "ai_seo_assistant", name: "AI SEO Asistanı", category: "ai", description: "AI destekli SEO öneri ve içerik optimizasyon manifesti.", requiredModules: ["plugins", "ai", "cms"], capabilities: ["ai.seo", "seo.suggestions"], permissions: ["plugins.ai.manage"] },
  { key: "fraud_rules", name: "Fraud Rules", category: "security", description: "Fraud kural motoru ve risk sinyal manifesti.", requiredModules: ["plugins", "security", "orders"], capabilities: ["fraud.rules", "risk.signals"], permissions: ["plugins.security.manage"] },
  { key: "loyalty_points", name: "Loyalty Points", category: "marketing", description: "Sadakat puanı ve ödül kurgusu manifesti.", requiredModules: ["plugins", "marketing", "wallets"], capabilities: ["loyalty.points", "rewards"], permissions: ["plugins.marketing.manage"] },
  { key: "affiliate_tracking", name: "Affiliate Tracking", category: "marketing", description: "Affiliate takip ve komisyon event manifesti.", requiredModules: ["plugins", "marketing"], capabilities: ["affiliate.links", "commission_tracking"], permissions: ["plugins.marketing.manage"] },
  { key: "live_chat", name: "Canlı Destek", category: "support", description: "Canlı destek kanalı ve müşteri iletişim manifesti.", requiredModules: ["plugins", "support", "notifications"], capabilities: ["support.live_chat", "agent_presence"], permissions: ["plugins.support.manage"] },
  { key: "chatbot", name: "Chatbot", category: "support", description: "Chatbot kanal manifesti ve destek otomasyonu bağlantısı.", requiredModules: ["plugins", "support", "ai"], capabilities: ["support.chatbot", "ai.responses"], permissions: ["plugins.support.manage"] },
  { key: "print_center", name: "Print Center", category: "operations", description: "Etiket, belge ve çıktı operasyonları manifesti.", requiredModules: ["plugins", "orders"], capabilities: ["print.labels", "documents"], permissions: ["plugins.operations.manage"] },
  { key: "barcode_qr_tools", name: "Barcode ve QR Tools", category: "operations", description: "Barkod, QR ve etiket araçları manifesti.", requiredModules: ["plugins", "catalog"], capabilities: ["barcode.generate", "qr.generate"], permissions: ["plugins.operations.manage"] },
  { key: "odoo_accounting_bridge", name: "Odoo Accounting Bridge", category: "erp", description: "Odoo muhasebe köprüsü ve belge sync manifesti.", requiredModules: ["plugins", "erp_odoo", "accounting"], capabilities: ["odoo.accounting", "sync.jobs"], permissions: ["plugins.erp.manage"] },
  { key: "medusa_catalog_bridge", name: "Medusa Catalog Bridge", category: "commerce", description: "Medusa katalog köprüsü ve ürün sync manifesti.", requiredModules: ["plugins", "medusa_commerce", "catalog"], capabilities: ["medusa.catalog", "sync.jobs"], permissions: ["plugins.commerce.manage"] },
  { key: "medusa_order_bridge", name: "Medusa Order Bridge", category: "commerce", description: "Medusa sipariş köprüsü ve order sync manifesti.", requiredModules: ["plugins", "medusa_commerce", "orders"], capabilities: ["medusa.orders", "sync.jobs"], permissions: ["plugins.commerce.manage"] }
] as const;

const credentialFields = {
  smtp: [
    { key: "host", label: "SMTP sunucusu", type: "text", required: true, secret: false },
    { key: "port", label: "Port", type: "text", required: true, secret: false },
    { key: "username", label: "Kullanıcı adı", type: "text", required: true, secret: false },
    { key: "password", label: "Parola", type: "password", required: true, secret: true }
  ],
  apiKey: [{ key: "apiKey", label: "API anahtarı", type: "password", required: true, secret: true }],
  token: [{ key: "accessToken", label: "Erişim tokenı", type: "password", required: true, secret: true }],
  payment: [
    { key: "publicKey", label: "Public key", type: "text", required: true, secret: false },
    { key: "secretKey", label: "Secret key", type: "password", required: true, secret: true }
  ],
  carrier: [
    { key: "accountCode", label: "Müşteri kodu", type: "text", required: true, secret: false },
    { key: "password", label: "Servis parolası", type: "password", required: true, secret: true }
  ],
  sip: [
    { key: "host", label: "SIP sunucusu", type: "text", required: true, secret: false },
    { key: "username", label: "Kullanıcı adı", type: "text", required: true, secret: false },
    { key: "password", label: "Parola", type: "password", required: true, secret: true }
  ],
  odoo: [
    { key: "baseUrl", label: "Odoo adresi", type: "text", required: true, secret: false },
    { key: "database", label: "Veritabanı", type: "text", required: true, secret: false },
    { key: "apiKey", label: "API anahtarı", type: "password", required: true, secret: true }
  ],
  endpointToken: [
    { key: "baseUrl", label: "Servis adresi", type: "text", required: true, secret: false },
    { key: "apiKey", label: "API anahtarı", type: "password", required: true, secret: true }
  ]
} as const;

const coreProviderSeeds = [
  { key: "smtp", name: "SMTP", category: "email", providerType: "email", description: "SMTP e-posta sağlayıcısı.", requiredPluginKey: "smtp_email", requiredModuleKey: "notifications", capabilities: ["email.send", "email.transactional"], fields: credentialFields.smtp },
  { key: "mailgun", name: "Mailgun", category: "email", providerType: "email", description: "Mailgun e-posta sağlayıcısı.", requiredPluginKey: "smtp_email", requiredModuleKey: "notifications", capabilities: ["email.send", "email.webhooks"], fields: credentialFields.apiKey },
  { key: "sendgrid", name: "SendGrid", category: "email", providerType: "email", description: "SendGrid e-posta sağlayıcısı.", requiredPluginKey: "smtp_email", requiredModuleKey: "notifications", capabilities: ["email.send", "email.templates"], fields: credentialFields.apiKey },
  { key: "netgsm", name: "Netgsm", category: "sms", providerType: "sms", description: "Netgsm SMS sağlayıcısı.", requiredPluginKey: "sms_gateway", requiredModuleKey: "notifications", capabilities: ["sms.send", "sms.delivery_status"], fields: credentialFields.apiKey },
  { key: "twilio_sms", name: "Twilio SMS", category: "sms", providerType: "sms", description: "Twilio SMS sağlayıcısı.", requiredPluginKey: "sms_gateway", requiredModuleKey: "notifications", capabilities: ["sms.send", "sms.delivery_status"], fields: credentialFields.apiKey },
  { key: "vonage_sms", name: "Vonage SMS", category: "sms", providerType: "sms", description: "Vonage SMS sağlayıcısı.", requiredPluginKey: "sms_gateway", requiredModuleKey: "notifications", capabilities: ["sms.send", "sms.delivery_status"], fields: credentialFields.apiKey },
  { key: "whatsapp_cloud", name: "WhatsApp Cloud", category: "whatsapp", providerType: "messaging", description: "WhatsApp Cloud mesajlaşma sağlayıcısı.", requiredPluginKey: "whatsapp_business", requiredModuleKey: "notifications", capabilities: ["whatsapp.messages", "whatsapp.templates"], fields: credentialFields.token },
  { key: "whatsapp_business_provider", name: "WhatsApp Business Provider", category: "whatsapp", providerType: "messaging", description: "WhatsApp Business çözüm sağlayıcı bağlantısı.", requiredPluginKey: "whatsapp_business", requiredModuleKey: "notifications", capabilities: ["whatsapp.messages", "whatsapp.delivery_status"], fields: credentialFields.token },
  { key: "stripe", name: "Stripe", category: "payments", providerType: "payment", description: "Stripe ödeme sağlayıcısı.", requiredPluginKey: "stripe_payments", requiredModuleKey: "payments", capabilities: ["payments.capture", "payments.refund"], fields: credentialFields.payment },
  { key: "paypal", name: "PayPal", category: "payments", providerType: "payment", description: "PayPal ödeme sağlayıcısı.", requiredPluginKey: "paypal_payments", requiredModuleKey: "payments", capabilities: ["payments.capture", "payments.refund"], fields: credentialFields.payment },
  { key: "iyzico", name: "iyzico", category: "payments", providerType: "payment", description: "iyzico ödeme sağlayıcısı.", requiredPluginKey: "iyzico_payments", requiredModuleKey: "payments", capabilities: ["payments.capture", "payments.installments"], fields: credentialFields.payment },
  { key: "paytr", name: "PayTR", category: "payments", providerType: "payment", description: "PayTR ödeme sağlayıcısı.", requiredModuleKey: "payments", capabilities: ["payments.capture"], fields: credentialFields.payment },
  { key: "payu", name: "PayU", category: "payments", providerType: "payment", description: "PayU ödeme sağlayıcısı.", requiredModuleKey: "payments", capabilities: ["payments.capture"], fields: credentialFields.payment },
  { key: "klarna", name: "Klarna", category: "payments", providerType: "payment", description: "Klarna ödeme sağlayıcısı.", requiredModuleKey: "payments", capabilities: ["payments.capture", "payments.installments"], fields: credentialFields.payment },
  { key: "apple_pay", name: "Apple Pay", category: "payments", providerType: "wallet", description: "Apple Pay cüzdan sağlayıcısı.", requiredModuleKey: "payments", capabilities: ["payments.wallet"], fields: credentialFields.payment },
  { key: "google_pay", name: "Google Pay", category: "payments", providerType: "wallet", description: "Google Pay cüzdan sağlayıcısı.", requiredModuleKey: "payments", capabilities: ["payments.wallet"], fields: credentialFields.payment },
  { key: "generic_shipping", name: "Generic Shipping", category: "shipping", providerType: "shipping", description: "Genel kargo sağlayıcı kontratı.", requiredPluginKey: "cargo_provider", requiredModuleKey: "logistics", capabilities: ["shipping.labels", "shipping.tracking"], fields: credentialFields.carrier },
  { key: "yurtici", name: "Yurtiçi Kargo", category: "shipping", providerType: "shipping", description: "Yurtiçi Kargo sağlayıcısı.", requiredPluginKey: "cargo_provider", requiredModuleKey: "logistics", capabilities: ["shipping.labels", "shipping.tracking"], fields: credentialFields.carrier },
  { key: "aras", name: "Aras Kargo", category: "shipping", providerType: "shipping", description: "Aras Kargo sağlayıcısı.", requiredPluginKey: "cargo_provider", requiredModuleKey: "logistics", capabilities: ["shipping.labels", "shipping.tracking"], fields: credentialFields.carrier },
  { key: "mng", name: "MNG Kargo", category: "shipping", providerType: "shipping", description: "MNG Kargo sağlayıcısı.", requiredPluginKey: "cargo_provider", requiredModuleKey: "logistics", capabilities: ["shipping.labels", "shipping.tracking"], fields: credentialFields.carrier },
  { key: "ptt", name: "PTT Kargo", category: "shipping", providerType: "shipping", description: "PTT Kargo sağlayıcısı.", requiredPluginKey: "cargo_provider", requiredModuleKey: "logistics", capabilities: ["shipping.labels", "shipping.tracking"], fields: credentialFields.carrier },
  { key: "ups", name: "UPS", category: "shipping", providerType: "shipping", description: "UPS kargo sağlayıcısı.", requiredPluginKey: "cargo_provider", requiredModuleKey: "logistics", capabilities: ["shipping.labels", "shipping.tracking"], fields: credentialFields.carrier },
  { key: "sip_trunk", name: "SIP Trunk", category: "voice", providerType: "voice", description: "SIP trunk dış arama sağlayıcısı.", requiredModuleKey: "notifications", capabilities: ["voice.outbound"], fields: credentialFields.sip },
  { key: "twilio_voice", name: "Twilio Voice", category: "voice", providerType: "voice", description: "Twilio dış arama sağlayıcısı.", requiredModuleKey: "notifications", capabilities: ["voice.outbound", "voice.status"], fields: credentialFields.apiKey },
  { key: "vonage_voice", name: "Vonage Voice", category: "voice", providerType: "voice", description: "Vonage dış arama sağlayıcısı.", requiredModuleKey: "notifications", capabilities: ["voice.outbound", "voice.status"], fields: credentialFields.apiKey },
  { key: "openai", name: "OpenAI", category: "ai", providerType: "ai", description: "OpenAI model sağlayıcısı.", requiredPluginKey: "ai_content_assistant", requiredModuleKey: "ai", capabilities: ["ai.text", "ai.embeddings"], fields: credentialFields.apiKey },
  { key: "anthropic", name: "Anthropic", category: "ai", providerType: "ai", description: "Anthropic model sağlayıcısı.", requiredModuleKey: "ai", capabilities: ["ai.text"], fields: credentialFields.apiKey },
  { key: "local_llm", name: "Local LLM", category: "ai", providerType: "ai", description: "Yerel model servis bağlantısı.", requiredModuleKey: "ai", capabilities: ["ai.text", "ai.local"], fields: credentialFields.endpointToken },
  { key: "google_maps", name: "Google Maps", category: "maps", providerType: "maps", description: "Google Maps harita sağlayıcısı.", requiredModuleKey: "localization", capabilities: ["maps.geocode", "maps.routes"], fields: credentialFields.apiKey },
  { key: "openstreetmap", name: "OpenStreetMap", category: "maps", providerType: "maps", description: "OpenStreetMap servis bağlantısı.", requiredModuleKey: "localization", capabilities: ["maps.geocode", "maps.routes"], fields: credentialFields.endpointToken },
  { key: "odoo_accounting", name: "Odoo Accounting", category: "accounting", providerType: "accounting", description: "Odoo muhasebe servis bağlantısı.", requiredPluginKey: "odoo_accounting_bridge", requiredModuleKey: "accounting", capabilities: ["accounting.sync", "accounting.documents"], fields: credentialFields.odoo },
  { key: "e_invoice_provider", name: "E-Fatura Sağlayıcısı", category: "accounting", providerType: "invoice", description: "E-fatura servis sağlayıcısı.", requiredPluginKey: "invoice_export", requiredModuleKey: "invoicing", capabilities: ["invoice.issue", "invoice.status"], fields: credentialFields.endpointToken },
  { key: "e_archive_provider", name: "E-Arşiv Sağlayıcısı", category: "accounting", providerType: "invoice", description: "E-arşiv servis sağlayıcısı.", requiredPluginKey: "invoice_export", requiredModuleKey: "invoicing", capabilities: ["archive.issue", "archive.status"], fields: credentialFields.endpointToken }
] as const;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hashPassword(password: string) {
  const iterations = 210_000;
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  return `pbkdf2-sha256$${iterations}$${salt}$${hash}`;
}

async function seedCoreModules(client: PoolClient) {
  for (const moduleDefinition of coreModules) {
    await client.query(
      `INSERT INTO platform_modules
        (key, name, description, category, status, version, installed_version, is_core, is_enabled,
         requires_license, license_status, dependencies, capabilities, settings_schema)
       VALUES ($1, $2, $3, $4, $5, '1.0.0', '1.0.0', true, $6, false, 'not_required', $7::jsonb, $8::jsonb, $9::jsonb)
       ON CONFLICT (key) DO UPDATE
       SET name = excluded.name,
           description = excluded.description,
           category = excluded.category,
           version = excluded.version,
           is_core = true,
           requires_license = excluded.requires_license,
           dependencies = excluded.dependencies,
           capabilities = excluded.capabilities,
           settings_schema = excluded.settings_schema,
           updated_at = now()`,
      [
        moduleDefinition.key,
        moduleDefinition.name,
        moduleDefinition.description,
        moduleDefinition.category,
        moduleDefinition.enabled ? "active" : "installed",
        moduleDefinition.enabled,
        JSON.stringify(moduleDefinition.dependencies),
        JSON.stringify(moduleDefinition.capabilities),
        JSON.stringify({
          type: "object",
          additionalProperties: true,
          moduleKey: moduleDefinition.key
        })
      ]
    );
  }
}

function themeDescription(theme: (typeof coreThemeSeeds)[number]) {
  return `${theme.industry} sektörüne göre hazırlanmış Commerce OS tema manifesti. Bu kayıt görsel dosya üretmez; storefront ve tenant atama motorları için katalog tanımıdır.`;
}

function themeDesignTokens(theme: (typeof coreThemeSeeds)[number]) {
  const premium = "isPremium" in theme && theme.isPremium;
  return {
    tokenSet: `theme.${theme.key}.v1`,
    colorMode: premium ? "premium" : theme.category,
    typography: theme.category === "luxury" ? "editorial" : "commerce",
    density: ["b2b", "industrial", "operations"].includes(theme.category) ? "compact" : "comfortable"
  };
}

function themeLayoutPresets(theme: (typeof coreThemeSeeds)[number]) {
  const capabilities = theme.capabilities as readonly string[];
  return {
    homepage: theme.category === "default" ? "starter" : "industry-showcase",
    listing: capabilities.includes("b2b-catalog") || capabilities.includes("bulk-order") ? "dense-catalog" : "visual-catalog",
    detail: capabilities.includes("appointment") || capabilities.includes("booking") ? "conversion-with-booking" : "commerce-detail"
  };
}

async function seedCoreThemes(client: PoolClient, actorPrincipalId: string) {
  for (const theme of coreThemeSeeds) {
    const result = await client.query<{ readonly id: string; readonly inserted: boolean }>(
      `INSERT INTO platform_themes
        (key, name, description, industry, category, status, version, is_core, is_premium,
         supports_dark_mode, supports_mobile, supports_rtl, preview_image_url, capabilities,
         design_tokens, layout_presets, required_modules)
       VALUES ($1, $2, $3, $4, $5, 'available', '1.0.0', true, $6, true, true, false, NULL,
               $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb)
       ON CONFLICT (key) DO UPDATE
       SET name = excluded.name,
           description = excluded.description,
           industry = excluded.industry,
           category = excluded.category,
           version = excluded.version,
           is_core = true,
           is_premium = excluded.is_premium,
           supports_dark_mode = excluded.supports_dark_mode,
           supports_mobile = excluded.supports_mobile,
           supports_rtl = excluded.supports_rtl,
           capabilities = excluded.capabilities,
           design_tokens = excluded.design_tokens,
           layout_presets = excluded.layout_presets,
           required_modules = excluded.required_modules,
           updated_at = now()
       RETURNING id, (xmax = 0) AS inserted`,
      [
        theme.key,
        theme.name,
        themeDescription(theme),
        theme.industry,
        theme.category,
        "isPremium" in theme && theme.isPremium === true,
        JSON.stringify(theme.capabilities),
        JSON.stringify(themeDesignTokens(theme)),
        JSON.stringify(themeLayoutPresets(theme)),
        JSON.stringify(theme.requiredModules)
      ]
    );

    const row = result.rows[0];
    if (row?.inserted) {
      await client.query(
        `INSERT INTO platform_theme_events (theme_id, tenant_id, event_type, actor_principal_id, payload)
         VALUES ($1, NULL, 'theme_seeded', $2::uuid, $3::jsonb)`,
        [row.id, actorPrincipalId, JSON.stringify({ key: theme.key, industry: theme.industry, category: theme.category })]
      );
      await client.query(
        `INSERT INTO operational_audit.audit_events
          (tenant_id, workspace_id, actor_id, actor_type, action, resource, result, payload, correlation_id, trace_id)
         VALUES ('platform', 'central-admin', $1, 'system', 'theme_seeded', 'theme-registry', 'accepted', $2::jsonb, 'platform-bootstrap', 'platform-bootstrap')`,
        [actorPrincipalId, JSON.stringify({ themeId: row.id, key: theme.key, industry: theme.industry })]
      );
    }
  }
}

function pluginSettingsSchema(plugin: (typeof corePluginSeeds)[number]) {
  return {
    type: "object",
    additionalProperties: true,
    pluginKey: plugin.key,
    fields: {
      enabledScope: { type: "string", enum: ["platform", "tenant"] },
      providerMode: { type: "string", enum: ["test", "live"] }
    }
  };
}

function pluginInstallManifest(plugin: (typeof corePluginSeeds)[number]) {
  return {
    manifestVersion: 1,
    sourceType: "core_manifest",
    entrypoint: `plugin://${plugin.key}`,
    requiredModules: plugin.requiredModules,
    permissions: plugin.permissions,
    activation: {
      mode: "registry-controlled",
      uploadRequired: false
    }
  };
}

async function seedCorePlugins(client: PoolClient, actorPrincipalId: string) {
  for (const plugin of corePluginSeeds) {
    const result = await client.query<{ readonly id: string; readonly inserted: boolean }>(
      `INSERT INTO platform_plugins
        (key, name, description, category, status, version, installed_version, provider, source_type,
         is_core, is_enabled, requires_license, license_status, required_modules, permissions,
         capabilities, settings_schema, install_manifest)
       VALUES ($1, $2, $3, $4, 'installed', '1.0.0', '1.0.0', 'commerce-os', 'core_manifest',
               true, false, false, 'not_required', $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb)
       ON CONFLICT (key) DO UPDATE
       SET name = excluded.name,
           description = excluded.description,
           category = excluded.category,
           version = excluded.version,
           installed_version = excluded.installed_version,
           provider = excluded.provider,
           source_type = excluded.source_type,
           is_core = true,
           requires_license = excluded.requires_license,
           license_status = excluded.license_status,
           required_modules = excluded.required_modules,
           permissions = excluded.permissions,
           capabilities = excluded.capabilities,
           settings_schema = excluded.settings_schema,
           install_manifest = excluded.install_manifest,
           updated_at = now()
       RETURNING id, (xmax = 0) AS inserted`,
      [
        plugin.key,
        plugin.name,
        plugin.description,
        plugin.category,
        JSON.stringify(plugin.requiredModules),
        JSON.stringify(plugin.permissions),
        JSON.stringify(plugin.capabilities),
        JSON.stringify(pluginSettingsSchema(plugin)),
        JSON.stringify(pluginInstallManifest(plugin))
      ]
    );

    const row = result.rows[0];
    if (row?.inserted) {
      await client.query(
        `INSERT INTO platform_plugin_events (plugin_id, tenant_id, event_type, actor_principal_id, payload)
         VALUES ($1, NULL, 'plugin_seeded', $2::uuid, $3::jsonb)`,
        [row.id, actorPrincipalId, JSON.stringify({ key: plugin.key, category: plugin.category })]
      );
      await client.query(
        `INSERT INTO operational_audit.audit_events
          (tenant_id, workspace_id, actor_id, actor_type, action, resource, result, payload, correlation_id, trace_id)
         VALUES ('platform', 'central-admin', $1, 'system', 'plugin_seeded', 'plugin-registry', 'accepted', $2::jsonb, 'platform-bootstrap', 'platform-bootstrap')`,
        [actorPrincipalId, JSON.stringify({ pluginId: row.id, key: plugin.key, category: plugin.category })]
      );
    }
  }
}

function providerCredentialSchema(provider: (typeof coreProviderSeeds)[number]) {
  return {
    type: "object",
    additionalProperties: false,
    fields: provider.fields
  };
}

function providerSettingsSchema(provider: (typeof coreProviderSeeds)[number]) {
  return {
    type: "object",
    additionalProperties: true,
    providerKey: provider.key,
    fields: [
      { key: "mode", label: "Çalışma modu", type: "select", required: true, options: ["test", "live"] }
    ]
  };
}

async function seedCoreProviders(client: PoolClient, actorPrincipalId: string) {
  for (const provider of coreProviderSeeds) {
    const requiredPluginKey = "requiredPluginKey" in provider ? provider.requiredPluginKey : null;
    const result = await client.query<{ readonly id: string; readonly inserted: boolean }>(
      `INSERT INTO platform_integration_providers
        (key, name, category, description, status, provider_type, is_core, is_enabled,
         supports_test_connection, supports_fallback, required_plugin_key, required_module_key,
         capabilities, credential_schema, settings_schema, health_check_schema)
       VALUES ($1, $2, $3, $4, 'available', $5, true, false, true, true, $6, $7,
               $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb)
       ON CONFLICT (key) DO UPDATE
       SET name = excluded.name,
           category = excluded.category,
           description = excluded.description,
           provider_type = excluded.provider_type,
           is_core = true,
           supports_test_connection = excluded.supports_test_connection,
           supports_fallback = excluded.supports_fallback,
           required_plugin_key = excluded.required_plugin_key,
           required_module_key = excluded.required_module_key,
           capabilities = excluded.capabilities,
           credential_schema = excluded.credential_schema,
           settings_schema = excluded.settings_schema,
           health_check_schema = excluded.health_check_schema,
           updated_at = now()
       RETURNING id, (xmax = 0) AS inserted`,
      [
        provider.key,
        provider.name,
        provider.category,
        provider.description,
        provider.providerType,
        requiredPluginKey,
        provider.requiredModuleKey,
        JSON.stringify(provider.capabilities),
        JSON.stringify(providerCredentialSchema(provider)),
        JSON.stringify(providerSettingsSchema(provider)),
        JSON.stringify({ adapterContract: "config-validation-only", networkProbeEnabled: false })
      ]
    );

    const row = result.rows[0];
    if (!row) {
      continue;
    }

    await client.query(
      `INSERT INTO platform_provider_resilience_policies
        (provider_id, timeout_ms, retry_count, retry_backoff_ms, circuit_breaker_enabled,
         circuit_breaker_failure_threshold, circuit_breaker_cooldown_seconds, fallback_provider_key, queue_on_failure)
       VALUES ($1, 5000, 2, 500, true, 5, 60, NULL, true)
       ON CONFLICT (provider_id) DO NOTHING`,
      [row.id]
    );

    if (row.inserted) {
      await client.query(
        `INSERT INTO platform_integration_events
          (provider_id, credential_id, tenant_id, event_type, actor_principal_id, payload)
         VALUES ($1, NULL, NULL, 'integration_provider_seeded', $2::uuid, $3::jsonb)`,
        [row.id, actorPrincipalId, JSON.stringify({ key: provider.key, category: provider.category })]
      );
      await client.query(
        `INSERT INTO operational_audit.audit_events
          (tenant_id, workspace_id, actor_id, actor_type, action, resource, result, payload, correlation_id, trace_id)
         VALUES ('platform', 'central-admin', $1, 'system', 'integration_provider_seeded', 'integration-vault', 'accepted',
                 $2::jsonb, 'platform-bootstrap', 'platform-bootstrap')`,
        [actorPrincipalId, JSON.stringify({ providerId: row.id, key: provider.key, category: provider.category })]
      );
    }
  }
}

function loadInitSql(fileName: string) {
  const filePath = resolve(repoRoot, "infra/postgres/init", fileName);
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("\\connect"))
    .join("\n");
}

async function runBootstrap() {
  const pool = new Pool({
    connectionString:
      process.env.PLATFORM_POSTGRES_URL ??
      "postgres://commerce_os:commerce_os_dev_password@localhost:5432/commerce_os_gateway",
    max: 2,
    connectionTimeoutMillis: 1500,
    application_name: "commerce-os-platform-bootstrap"
  });

  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL ?? "admin@commerceos.local";
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "CommerceOS@2026!";
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME ?? "Commerce OS Super Admin";
  const allowDevCredentials = process.env.BOOTSTRAP_ALLOW_DEV_CREDENTIALS === "true";
  const usingDefaultPassword = adminPassword === "CommerceOS@2026!";
  const centralTenantId = "platform";
  const centralWorkspaceId = "central-admin";

  if (usingDefaultPassword && !allowDevCredentials) {
    throw new Error("BOOTSTRAP_ALLOW_DEV_CREDENTIALS=true is required for the development bootstrap password.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(loadInitSql("002-foundation-runtime-contracts.sql"));
    await client.query(loadInitSql("003-business-platform-core.sql"));
    await client.query(loadInitSql("004-operational-runtime.sql"));

    await client.query(
      `INSERT INTO tenant_registry.tenants
        (tenant_id, lifecycle_state, isolation_mode, default_locale, default_currency, display_name, country_code, timezone)
       VALUES ($1, 'active', 'schema-per-tenant', 'tr-TR', 'TRY', 'Commerce OS Platform', 'TR', 'Europe/Istanbul')
       ON CONFLICT (tenant_id) DO UPDATE
       SET updated_at = now(),
           display_name = COALESCE(tenant_registry.tenants.display_name, excluded.display_name),
           country_code = COALESCE(tenant_registry.tenants.country_code, excluded.country_code),
           timezone = COALESCE(tenant_registry.tenants.timezone, excluded.timezone)`,
      [centralTenantId]
    );

    await client.query(
      `INSERT INTO tenant_registry.tenant_workspaces (tenant_id, workspace_id, workspace_type, enabled, role_ids)
       VALUES ($1, $2, 'central-admin', true, ARRAY['super_admin'])
       ON CONFLICT (tenant_id, workspace_id) DO UPDATE SET enabled = true`,
      [centralTenantId, centralWorkspaceId]
    );

    await client.query(
      `INSERT INTO tenant_registry.workspaces (workspace_id, tenant_id, workspace_type, isolated_by_tenant)
       VALUES ($1, $2, 'central-admin', false)
       ON CONFLICT (workspace_id) DO UPDATE SET tenant_id = excluded.tenant_id, workspace_type = excluded.workspace_type`,
      [centralWorkspaceId, centralTenantId]
    );

    await client.query(
      `INSERT INTO tenant_isolation.isolation_plans
        (tenant_id, isolation_mode, data_residency_mode, postgres_schema, redis_key_prefix, minio_bucket_prefix,
         meilisearch_index_prefix, cache_namespace, queue_namespace, event_namespace, storage_namespace, erp_plan)
       VALUES
        ($1, 'schema-per-tenant', 'country-bound', 'tenant_platform', 'tenant:platform', 'tenant-platform',
         'tenant_platform', 'cache:tenant:platform', 'queue:tenant:platform', 'event:tenant:platform',
         'storage/tenant/platform', '{}'::jsonb)
       ON CONFLICT (tenant_id) DO UPDATE
       SET cache_namespace = excluded.cache_namespace,
           queue_namespace = excluded.queue_namespace,
           event_namespace = excluded.event_namespace,
           storage_namespace = excluded.storage_namespace`,
      [centralTenantId]
    );

    const existingPrincipal = await client.query<{ principal_id: string }>(
      `SELECT principal_id FROM auth_core.principals WHERE lower(email) = lower($1) LIMIT 1`,
      [adminEmail]
    );

    let principalId = existingPrincipal.rows[0]?.principal_id;
    let principalCreated = false;
    let credentialCreated = false;

    if (!principalId) {
      const inserted = await client.query<{ principal_id: string }>(
        `INSERT INTO auth_core.principals
          (principal_type, email, display_name, email_verified_at, status)
         VALUES ('platform-operator', $1, $2, now(), 'active')
         RETURNING principal_id`,
        [adminEmail, adminName]
      );
      principalId = inserted.rows[0]?.principal_id;
      principalCreated = true;
    } else {
      await client.query(
        `UPDATE auth_core.principals
         SET display_name = COALESCE(display_name, $2),
             email_verified_at = COALESCE(email_verified_at, now()),
             status = CASE WHEN status = 'pending_verification' THEN 'active' ELSE status END
         WHERE principal_id = $1`,
        [principalId, adminName]
      );
    }

    if (!principalId) {
      throw new Error("bootstrap_principal_create_failed");
    }

    const credential = await client.query(
      `SELECT credential_id FROM auth_core.password_credentials WHERE principal_id = $1 LIMIT 1`,
      [principalId]
    );

    if (credential.rowCount === 0) {
      await client.query(
        `INSERT INTO auth_core.password_credentials (principal_id, password_hash, password_hash_algorithm)
         VALUES ($1, $2, 'pbkdf2-sha256')`,
        [principalId, hashPassword(adminPassword)]
      );
      credentialCreated = true;
    }

    await client.query(
      `INSERT INTO auth_core.workspace_access_grants
        (principal_id, tenant_id, workspace_id, role_ids, permission_ids)
       SELECT $1::uuid, $2, $3, ARRAY['super_admin'], ARRAY['*','runtime.read','tenant.create','tenant.read','audit.read','session.manage']
       WHERE NOT EXISTS (
         SELECT 1
         FROM auth_core.workspace_access_grants
         WHERE principal_id = $1::uuid AND tenant_id = $2 AND workspace_id = $3
       )`,
      [principalId, centralTenantId, centralWorkspaceId]
    );

    await seedCoreModules(client);
    await seedCoreThemes(client, principalId);
    await seedCorePlugins(client, principalId);
    await seedCoreProviders(client, principalId);

    await client.query(
      `INSERT INTO operational_audit.audit_events
        (tenant_id, workspace_id, actor_id, actor_type, action, resource, result, payload, correlation_id, trace_id)
       VALUES ($1, $2, $3, 'system', 'platform.bootstrap', 'first-access', 'accepted', $4::jsonb, $5, $6)`,
      [
        centralTenantId,
        centralWorkspaceId,
        principalId,
        {
          adminEmailHash: sha256(adminEmail),
          principalCreated,
          credentialCreated,
          passwordChanged: credentialCreated
        },
        "platform-bootstrap",
        "platform-bootstrap"
      ]
    );

    await client.query("COMMIT");
    console.log(
      JSON.stringify(
        {
          status: "ok",
          schemasReady: ["auth_core", "tenant_registry", "workspace_runtime", "operational_audit", "event_core"],
          admin: {
            email: adminEmail,
            role: "super_admin",
            tenant: centralTenantId,
            workspace: centralWorkspaceId,
            principalCreated,
            passwordChanged: credentialCreated
          }
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  try {
    await runBootstrap();
  } catch (error) {
    if (!directOnly && existsSync(resolve(repoRoot, "docker-compose.yml"))) {
      const result = spawnSync(
        "docker",
        [
          "compose",
          "--project-directory",
          repoRoot,
          "exec",
          "-T",
          "-e",
          "COMMERCE_OS_BOOTSTRAP_IN_CONTAINER=1",
          "gateway-api",
          "pnpm",
          "--filter",
          "@commerce-os/gateway-api",
          "platform:bootstrap:direct"
        ],
        { cwd: repoRoot, stdio: "inherit", shell: process.platform === "win32" }
      );

      if (result.status === 0) {
        return;
      }
    }

    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

await main();
