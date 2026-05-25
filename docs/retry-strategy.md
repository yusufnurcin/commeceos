# Retry Strategy

Foundation retry policy is contract-first:

- max attempts: 3
- backoff: decorrelated jitter
- base delay: 250 ms
- max delay: 5000 ms
- idempotency header: `idempotency-key`

## Rules

- Mutating commands must provide an idempotency key.
- Retries must not create duplicate ERP documents, orders, invoices, notifications, or sync checkpoints.
- Dead-letter queues must preserve tenant, workspace, correlation ID, trace ID, source, and target.
- Gateway service probes use bounded retries only.
