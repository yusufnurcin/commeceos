export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  readonly service: string;
  readonly correlationId?: string | undefined;
  readonly traceId?: string | undefined;
  readonly tenantId?: string | undefined;
  readonly workspaceId?: string | undefined;
}

export function log(level: LogLevel, message: string, context: LogContext, details: Record<string, unknown> = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
    ...details
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}
