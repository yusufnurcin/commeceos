# Gateway Boundaries

The API gateway is the only planned ingress for platform experiences.

It must remain responsible for tenant resolution, workspace context, authentication enforcement, and orchestration across Medusa, Odoo, search, realtime, notification, and AI services.

No raw Odoo UI routes and no direct Medusa admin routes should be exposed through this gateway.
