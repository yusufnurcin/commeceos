import pg, { type QueryResultRow } from "pg";
import type { GatewayEnvironment } from "../config/env";

const { Pool } = pg;

export type QueryValue = unknown;

export interface RuntimeDatabase {
  readonly available: boolean;
  query<T extends QueryResultRow>(text: string, values?: readonly QueryValue[]): Promise<readonly T[]>;
  one<T extends QueryResultRow>(text: string, values?: readonly QueryValue[]): Promise<T | undefined>;
  transaction<T>(callback: (client: RuntimeDatabaseClient) => Promise<T>): Promise<T>;
}

export interface RuntimeDatabaseClient {
  query<T extends QueryResultRow>(text: string, values?: readonly QueryValue[]): Promise<readonly T[]>;
  one<T extends QueryResultRow>(text: string, values?: readonly QueryValue[]): Promise<T | undefined>;
}

export class RuntimeStoreUnavailableError extends Error {
  constructor(message = "runtime_store_unavailable") {
    super(message);
    this.name = "RuntimeStoreUnavailableError";
  }
}

function createClient(client: pg.PoolClient): RuntimeDatabaseClient {
  return {
    async query<T extends QueryResultRow>(text: string, values: readonly QueryValue[] = []) {
      const result = await client.query<T>(text, [...values]);
      return result.rows as readonly T[];
    },
    async one<T extends QueryResultRow>(text: string, values: readonly QueryValue[] = []) {
      const result = await client.query<T>(text, [...values]);
      return result.rows[0] as T | undefined;
    }
  };
}

export function createRuntimeDatabase(env: GatewayEnvironment): RuntimeDatabase {
  const pool = new Pool({
    connectionString: env.platformPostgresUrl,
    max: 6,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 1_500,
    application_name: "commerce-os-gateway-runtime"
  });

  return {
    available: true,
    async query<T extends QueryResultRow>(text: string, values: readonly QueryValue[] = []) {
      const result = await pool.query<T>(text, [...values]);
      return result.rows as readonly T[];
    },
    async one<T extends QueryResultRow>(text: string, values: readonly QueryValue[] = []) {
      const result = await pool.query<T>(text, [...values]);
      return result.rows[0] as T | undefined;
    },
    async transaction<T>(callback: (client: RuntimeDatabaseClient) => Promise<T>) {
      const client = await pool.connect();
      const runtimeClient = createClient(client);

      try {
        await client.query("BEGIN");
        const result = await callback(runtimeClient);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

export function isRuntimeStoreUnavailable(error: unknown) {
  return (
    error instanceof RuntimeStoreUnavailableError ||
    (error instanceof Error &&
      (error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("timeout")))
  );
}
