export interface RetryOptions {
  readonly attempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === options.attempts) {
        break;
      }

      const exponentialDelay = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * options.baseDelayMs);
      await new Promise((resolve) => setTimeout(resolve, exponentialDelay + jitter));
    }
  }

  throw lastError;
}
