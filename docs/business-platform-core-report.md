# Business Platform Core Faz Raporu

Tarih: 2026-05-25

Bu faz foundation/runtime sınırından business platform core sınırına geçti. Demo data, fake KPI, mock tenant, seed admin, örnek order/customer veya CRUD generator yaklaşımı kullanılmadı.

## Kurulan Çekirdekler

- Auth core: access token, refresh token rotation contract, session fingerprint, device tracking, MFA foundation, password policy, email verification, tenant/workspace scoped session, role permission binding, impersonation control, login activity, suspicious login detection, rate limit ve secure cookie stratejisi.
- Tenant core: tenant registry, lifecycle, domain mapping, workspace registry, feature flags, limits, branding, locale/currency, ERP bridge, commerce bridge ve request/service/event/cache/storage/queue izolasyon namespace modeli.
- Workspace system: central-admin, tenant-admin, seller-workspace, customer-workspace, courier-workspace, finance-workspace, accounting-workspace, marketing-workspace, support-workspace, warehouse-workspace ve procurement-workspace için izole surface kontratları.
- Event system: versioned event contracts, idempotency key, retry topology, dead letter queue, replay, audit ve realtime subscription kontratları.
- Odoo bridge: product, inventory, warehouse, accounting, invoice, procurement, HR, CRM, POS ve shipment sync operasyonları gateway-only engine bridge olarak tanımlandı. Raw Odoo UI kapalıdır.
- Medusa orchestration: catalog, pricing, checkout, cart, order, return, promotion, region ve tax orchestration gateway-only contract olarak tanımlandı. Medusa admin UI kapalıdır.
- Central Admin: Global Commerce Control Center workspace client shell eklendi; Türkçe UTF-8 UI, büyük responsive logo, adaptive navigation, command surface, operations center, event/bridge/topology görünürlüğü eklendi.

## Çalışan Endpointler

Tüm `/v1/*` business endpointleri tenant, workspace ve doğrulanmış JWT veya service-token boundary ister.

- `GET /v1/auth/core`
- `GET /v1/auth/verify`
- `GET /v1/tenants/isolation`
- `GET /v1/workspaces/registry`
- `GET /v1/events/contracts`
- `GET /v1/bridges/odoo`
- `GET /v1/bridges/medusa`
- `GET /v1/control-center/health-matrix`
- `GET /v1/runtime/verification`

## Runtime Verification

Geçici gateway portu: `18080`

Headers:

```http
x-commerce-service-token: commerce_os_gateway_service_dev_token
x-commerce-tenant: tenant-alpha
x-commerce-workspace: central-admin
```

Sonuç:

- `/health`: `200`
- `/v1/auth/core`: `200`
- `/v1/tenants/isolation`: `200`
- `/v1/workspaces/registry`: `200`
- `/v1/events/contracts`: `200`
- `/v1/bridges/odoo`: `200`
- `/v1/bridges/medusa`: `200`
- `/v1/runtime/verification`: `200`
- Headersız `/v1/auth/core`: `401`

## Tenant Isolation Verification

`/v1/tenants/isolation` endpointi tenant header değerinden aşağıdaki namespace kontratlarını üretir:

- cache namespace
- storage namespace
- queue namespace
- event namespace
- Redis key prefix
- MinIO bucket prefix
- Meilisearch index prefix

Tenant middleware scope sadece request seviyesinde değildir; service, event, cache, storage ve queue seviyeleri de kontrata dahil edildi.

## Auth Verification

- Service-token hash doğrulaması aktif.
- JWT doğrulaması HS256 signature, issuer, audience, exp, nbf, jti, token_type, tenant claim ve workspace claim kontrollerini içerir.
- Session cookie fake kabul edilmiyor; persistent session adapter olmadan business route erişimi `unsupported` kabul edilir.
- Production ortamda default auth secret ve default service-token ile boot engellenir.

## Event Verification

- Event contracts: `workflow.command.accepted`, `sync.job.requested`, `erp.bridge.operation.requested`, `commerce.orchestration.requested`, `notification.dispatch.requested`.
- Her event tenant scoped, idempotency required ve audit required olarak tanımlandı.
- DLQ ve replay contract gateway topology endpointlerine eklendi.
- Realtime service business channels mounted döner ve `/runtime/subscriptions` endpointi eklendi.

## Docker Verification

Çalıştırılan doğrulamalar:

```bash
docker compose --env-file ./infra/env/local.example.env config --quiet
docker compose --env-file ./infra/env/local.example.env build gateway-api realtime notification-engine medusa
```

Sonuç:

- Compose config doğrulandı.
- `commerce-os-v2-gateway-api:latest` build edildi.
- `commerce-os-v2-realtime:latest` build edildi.
- `commerce-os-v2-notification-engine:latest` build edildi.
- `commerce-os-v2-medusa:latest` build edildi.

## Build, Typecheck, Lint

Çalıştırılan komutlar:

```bash
pnpm typecheck
pnpm build
pnpm lint
```

Sonuç:

- Typecheck: 17/17 package başarılı.
- Build: 17/17 package başarılı.
- Lint: 17/17 package başarılı.
- Medusa build çıktısında admin build disabled kaldı.

## Browser Verification

Central Admin `http://127.0.0.1:3001` üzerinde in-app Browser ile açıldı.

- Title: `Zyber Cart Commerce OS | Global Control Center`
- Logo metni görünür: `Zyber Cart`, `Commerce OS`
- Control Center metni görünür.
- Odoo ERP Bridge görünür.
- Medusa Commerce Orchestrator görünür.
- 390px mobil viewport: yatay taşma yok.
- 1440px desktop viewport: yatay taşma yok.

## Not

Turbo komutları git durumunu okurken Windows üzerinde `C:/` için dubious ownership uyarısı verdi. Bu uyarı typecheck, build, lint veya runtime doğrulamalarını başarısız yapmadı.
