import { connect } from "node:net";
import type { ServiceRegistryEntry } from "./service-registry";
import { withRetry } from "./retry";

export interface HealthMatrixEntry {
  readonly service: string;
  readonly layer: string;
  readonly status: "ok" | "failed";
  readonly criticality: string;
  readonly probeType: string;
  readonly latencyMs: number;
  readonly checkedAt: string;
  readonly error?: string;
}

function probeTcp(host: string, port: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("tcp_timeout"));
    }, timeoutMs);

    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve();
    });

    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function probeHttp(url: string, timeoutMs: number): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal });
    if (!response.ok) {
      throw new Error(`http_${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkService(entry: ServiceRegistryEntry): Promise<HealthMatrixEntry> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  try {
    await withRetry(
      async () => {
        if (entry.probeType === "tcp") {
          if (!entry.host || !entry.port) {
            throw new Error("missing_tcp_target");
          }

          await probeTcp(entry.host, entry.port, 3000);
          return;
        }

        if (!entry.healthUrl) {
          throw new Error("missing_http_target");
        }

        await probeHttp(entry.healthUrl, 3000);
      },
      { attempts: 2, baseDelayMs: 100, maxDelayMs: 500 }
    );

    return {
      service: entry.name,
      layer: entry.layer,
      status: "ok",
      criticality: entry.criticality,
      probeType: entry.probeType,
      latencyMs: Date.now() - startedAt,
      checkedAt
    };
  } catch (error) {
    return {
      service: entry.name,
      layer: entry.layer,
      status: "failed",
      criticality: entry.criticality,
      probeType: entry.probeType,
      latencyMs: Date.now() - startedAt,
      checkedAt,
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
}

export async function createHealthMatrix(registry: readonly ServiceRegistryEntry[]) {
  const entries = await Promise.all(registry.map((entry) => checkService(entry)));
  const criticalFailures = entries.filter((entry) => entry.criticality === "critical" && entry.status !== "ok");

  return {
    status: criticalFailures.length === 0 ? "ready" : "degraded",
    criticalFailures: criticalFailures.map((entry) => entry.service),
    entries
  } as const;
}

export type ServiceHealthMatrix = Awaited<ReturnType<typeof createHealthMatrix>>;
