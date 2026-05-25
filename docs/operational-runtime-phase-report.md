# Operational Runtime Phase Raporu

Tarih: 2026-05-25

Bu fazda Commerce OS runtime gerçek gateway, PostgreSQL-backed operational store, websocket fabric ve runtime-fed Central Admin yüzeyi üzerine taşındı. Fake token, hardcoded credential, mock tenant, demo KPI, fake analytics, lorem içerik veya placeholder copilot üretilmedi.

## Runtime Endpoint Listesi

Auth runtime:

- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `POST /v1/auth/refresh`
- `GET /v1/auth/me`
- `GET /v1/auth/sessions`
- `POST /v1/auth/sessions/revoke`
- `POST /v1/auth/mfa/challenge`
- `POST /v1/auth/mfa/verify`
- `POST /v1/auth/password-reset/request`
- `POST /v1/auth/password-reset/confirm`
- `POST /v1/auth/email-verification/request`
- `POST /v1/auth/email-verification/confirm`
- `GET /v1/auth/activity`

Operational runtime:

- `POST /v1/tenants`
- `GET /v1/tenants/registry`
- `GET /v1/workspaces/runtime`
- `GET /v1/workspaces/registry`
- `GET /v1/control-center/operations`
- `GET /v1/queues/runtime`
- `GET /v1/audit/runtime`
- `GET /v1/ai/operations`
- `GET /v1/runtime/verification`
- `GET /v1/bridges/odoo/runtime`
- `POST /v1/bridges/odoo/sync`
- `GET /v1/bridges/medusa/runtime`
- `POST /v1/bridges/medusa/orchestrate`

Realtime runtime:

- `GET /health`
- `GET /ready`
- `GET /runtime/channels`
- `GET /runtime/subscriptions`
- `GET /runtime/presence`
- `WS /ws`

## Auth Verification

- Login gerçek `auth_core.principals`, `auth_core.password_credentials` ve `auth_core.workspace_access_grants` kayıtları üzerinden çalışır.
- Password hash `pbkdf2-sha256$iterations$salt$hash` formatını doğrular.
- Access token yalnızca gerçek principal ve workspace grant sonrası imzalanır.
- Refresh token family, rotation ve reuse detection DB-backed çalışır.
- Session revoke gerçek session kaydını `revoked` yapar.
- MFA challenge adapter olmayan yollar fake başarı döndürmez; `adapter_required` döner.
- Runtime store yokken login `503 runtime_store_unavailable` döndürdü; fake token üretilmedi.

## Tenant Isolation Verification

- Tenant onboarding sadece insert değildir: tenant registry, schema creation, isolation plan, workspace provisioning, branding, locale/currency, limits, Odoo bridge, Medusa bridge, lifecycle event ve event outbox aynı orchestration transaction içinde çalışır.
- Tenant namespace kapsamları: request, service, event, cache, storage, queue.
- İzolasyon kolonları `tenant_isolation.isolation_plans` içine eklendi: cache, queue, event ve storage namespace.

## Workspace Isolation Verification

- Runtime workspace registry gerçek `tenant_registry.tenant_workspaces` tablosundan beslenir.
- Activity stream `workspace_runtime.activity_stream`, notification state `workspace_runtime.notifications`, layout memory `workspace_runtime.layout_memory`, worker heartbeat `workspace_runtime.worker_heartbeats` tablolarına bağlandı.
- Veri yoksa premium operational empty state döner.

## Websocket Verification

Çalıştırılan smoke test:

- `WS /ws` service-token ile bağlandı.
- Tenant: `tenant-alpha`
- Workspace: `central-admin`
- `presence.connected` mesajı döndü.
- `tenant:tenant-alpha:workspace:central-admin:audit` channel subscribe kabul edildi.
- `ping` mesajına `pong` döndü.

## Realtime Channel Listesi

- `workflow`
- `sync`
- `erp-bridge`
- `commerce`
- `order`
- `inventory`
- `finance`
- `notification`
- `ai`
- `audit`

Her channel tenant scoped; workspace-scoped channel pathleri `tenant:{tenantId}:workspace:{workspaceId}:{channel}` formatındadır.

## Event Contracts

- `workflow.command.accepted`
- `sync.job.requested`
- `erp.bridge.operation.requested`
- `commerce.orchestration.requested`
- `notification.dispatch.requested`

Retry topology:

- Max attempts: `3`
- Backoff: `decorrelated-jitter`
- Idempotency header: `idempotency-key`
- DLQ: `stream:dead-letter`
- Replay: `x-commerce-replay-id`

## Odoo Bridge Verification

Odoo raw UI açılmadı. Operational bridge jobları `bridge_core.odoo_sync_jobs` tablosuna ve `erp.bridge.operation.requested` event outbox kaydına gider.

Operasyonlar:

- product sync
- inventory sync
- warehouse sync
- accounting sync
- invoice sync
- procurement sync
- HR sync
- CRM sync
- POS sync
- shipment sync

## Medusa Verification

Medusa admin UI kapalı kalır. Commerce orchestration jobları `bridge_core.medusa_orchestration_jobs` tablosuna ve `commerce.orchestration.requested` event outbox kaydına gider.

Operasyonlar:

- catalog runtime
- pricing runtime
- region runtime
- tax runtime
- cart runtime
- checkout runtime
- order runtime
- return runtime
- promotion runtime

## Observability ve Audit

- Gateway response headers: `x-correlation-id`, `x-trace-id`
- Runtime audit table: `operational_audit.audit_events`
- Auth audit: `auth_core.auth_audit_events`
- Event audit: `event_core.event_audit`
- Sync audit: `event_core.event_outbox`, `event_core.event_dead_letters`
- ERP audit: `bridge_core.odoo_sync_jobs`
- Commerce audit: `bridge_core.medusa_orchestration_jobs`

## AI Operations Layer

AI layer fake response üretmez. `ai_ops.operational_signals` tablosu ve aşağıdaki kontratlar hazırlandı:

- operational recommendations
- anomaly detection
- sync anomaly
- inventory anomaly
- fraud signal
- operational copilots
- AI context isolation
- AI audit visibility

## Central Admin Verification

- Central Admin artık server-side runtime API okur.
- Env yoksa demo dashboard yerine premium empty operational state gösterir.
- In-app Browser doğrulaması:
  - Brand görünür.
  - Global Operations Center shell görünür.
  - `Runtime bağlantısı bekleniyor` empty state görünür.
  - Lorem ve demo KPI metni yok.
  - 390px ve 1440px viewportlarda yatay taşma yok.

## Build, Lint, Docker Verification

Başarılı:

- `pnpm typecheck`
- `pnpm build`
- `pnpm lint`
- `docker compose --env-file ./infra/env/local.example.env config --quiet`
- `docker compose --env-file ./infra/env/local.example.env build gateway-api realtime notification-engine medusa`

Not: `central-admin` docker-compose içinde servis olarak tanımlı olmadığı için image build kapsamına alınmadı; Next production build `pnpm build` içinde başarıyla doğrulandı.

## Runtime Smoke Sonuçları

Gateway:

- `/health`: `200`
- `/v1/runtime/verification`: `200`
- `/v1/control-center/operations`: `200 store_unavailable` with premium empty state
- `/v1/workspaces/runtime`: `200 store_unavailable` with premium empty state
- `/v1/queues/runtime`: `200 store_unavailable` with premium empty state
- `/v1/audit/runtime`: `200 store_unavailable` with premium empty state
- `/v1/ai/operations`: `200 store_unavailable` with premium empty state
- `/v1/bridges/odoo/runtime`: `200 store_unavailable` with premium empty state
- `/v1/bridges/medusa/runtime`: `200 store_unavailable` with premium empty state
- `/v1/auth/login`: `503 runtime_store_unavailable` when PostgreSQL runtime store is not connected

Bu davranış bilinçlidir: veri veya store yokken fake token, fake analytics veya mock operational data üretilmez.
