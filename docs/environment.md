# Environment Strategy

Environment configuration is split into foundation, app, and service scopes.

## Files

- `infra/env/local.example.env`: Docker foundation defaults
- `apps/*/.env.example`: public app shell configuration
- `services/*/.env.example`: service runtime contracts

## Secrets

The checked-in values are development placeholders. Production must provide:

- PostgreSQL credentials
- Redis credentials if enabled
- Meilisearch master key
- MinIO access credentials
- Odoo database manager password
- Odoo Enterprise license and addon source
- Medusa JWT and cookie secrets
- provider credentials for AI, email, SMS, payment, and observability

## Service Discovery

Docker Compose services resolve through the shared `commerce-os-network` bridge network:

- `postgres`
- `redis`
- `meilisearch`
- `minio`
- `odoo`
- `medusa`
- `gateway-api`

Local host ports are configurable in `infra/env/local.example.env`.
