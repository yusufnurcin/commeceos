# Auth Flow Map

```mermaid
sequenceDiagram
  participant Client
  participant Gateway
  participant Policy
  participant Service

  Client->>Gateway: Request with JWT/session/service token
  Gateway->>Gateway: Resolve correlation ID and trace ID
  Gateway->>Gateway: Resolve tenant and workspace headers
  Gateway->>Policy: RBAC + ABAC contract evaluation
  Policy-->>Gateway: Allow or deny
  Gateway->>Gateway: Write audit log contract
  Gateway->>Service: Forward only validated service call
```

## Hybrid Auth Boundary

Accepted foundation mechanisms:

- JWT bearer token
- platform session cookie
- service token

Raw Odoo sessions are not accepted as platform auth.

## Authorization Boundary

RBAC contracts define coarse roles. ABAC constraints bind access to tenant and workspace context.
