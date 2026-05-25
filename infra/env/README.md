# Environment Architecture

Environment files are split by responsibility:

- `infra/env/local.example.env`: local Docker foundation variables
- app-level `.env.example` files: public runtime shell settings only
- service-level `.env.example` files: service-local connection contracts

Do not commit real tenant credentials, Odoo enterprise license details, payment keys, SMTP secrets, or AI provider keys.
