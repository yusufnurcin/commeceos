# Queue Topology

Redis is the foundation queue and event-bus substrate.

| Queue | Redis DB | Stream | Dead Letter Stream | Priority |
| --- | ---: | --- | --- | --- |
| `commerce-os.sync` | 5 | `stream:sync` | `stream:sync:dlq` | high |
| `commerce-os.notification` | 6 | `stream:notification` | `stream:notification:dlq` | normal |
| `commerce-os.ai` | 7 | `stream:ai` | `stream:ai:dlq` | low |

## Event Streams

- `stream:order`
- `stream:inventory`
- `stream:finance`
- `stream:sync`
- `stream:notification`
- `stream:ai`

All queue contracts require idempotency. No fake jobs or demo events are inserted in this phase.
