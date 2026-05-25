# Healthcheck Strategy

Healthchecks are infrastructure-first and intentionally shallow at this stage.

- Containers expose liveness checks through Docker Compose.
- Application shells expose `/health` route handlers only.
- Service shells expose `/health` and `/ready` endpoints only.
- Readiness must stay dependency-aware when business modules are added later.

The PowerShell healthcheck validates local ports and HTTP liveness for the foundation stack after `pnpm docker:up`.
