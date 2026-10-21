import type { MemoryAdapter } from '@cogitator-ai/types';

export type ReadinessCheckStatus = 'ok' | 'error' | 'unchecked';
export type ReadinessStatus = 'ok' | 'error';

export interface ReadinessResponse {
  status: ReadinessStatus;
  checks: Record<string, ReadinessCheckStatus>;
}

export interface ReadinessResult {
  statusCode: 200 | 503;
  body: ReadinessResponse;
}

export interface ReadinessTarget {
  getMemory?: () => Promise<MemoryAdapter | undefined | null>;
  config?: {
    memory?: {
      adapter?: string;
    };
  };
  runtime?: ReadinessTarget;
}

export interface ReadinessOptions {
  timeoutMs?: number;
}

export const DEFAULT_READINESS_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });
  promise.catch(() => undefined);
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Runs readiness checks for the server, verifying connectivity to configured dependencies.
 *
 * Enforces a 3-second timeout per check. Adapters without healthCheck() report 'unchecked'
 * and do not fail readiness. Unconfigured memory is not treated as a connection failure.
 * Returns HTTP 200 when no checks fail, and 503 when any check fails.
 */
export async function checkReadiness(
  target?: ReadinessTarget | null,
  options: ReadinessOptions = {}
): Promise<ReadinessResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS;
  const checks: Record<string, ReadinessCheckStatus> = {};

  const cogitator =
    target && 'runtime' in target && (target as { runtime?: ReadinessTarget }).runtime
      ? (target as { runtime: ReadinessTarget }).runtime
      : target;

  const configuredAdapter = cogitator?.config?.memory?.adapter ?? target?.config?.memory?.adapter;

  if (cogitator?.getMemory) {
    try {
      const memory = await withTimeout(
        cogitator.getMemory(),
        timeoutMs,
        'Memory initialization timed out'
      );

      if (!memory) {
        if (configuredAdapter) {
          console.error(
            `[readiness] Configured memory adapter "${configuredAdapter}" failed to connect`
          );
          checks.memory = 'error';
        }
      } else if (typeof memory.healthCheck === 'function') {
        const result = await withTimeout(
          memory.healthCheck(),
          timeoutMs,
          'Memory healthCheck timed out'
        );
        if (result?.success) {
          checks.memory = 'ok';
        } else {
          console.error('[readiness] Memory healthCheck failed:', result?.error ?? 'Unknown error');
          checks.memory = 'error';
        }
      } else {
        checks.memory = 'unchecked';
      }
    } catch (err) {
      console.error(
        '[readiness] Memory check error:',
        err instanceof Error ? err.message : String(err)
      );
      checks.memory = 'error';
    }
  } else if (configuredAdapter) {
    console.error(
      `[readiness] Configured memory adapter "${configuredAdapter}" is not initialized`
    );
    checks.memory = 'error';
  }

  const anyFailed = Object.values(checks).some((s) => s === 'error');

  return {
    statusCode: anyFailed ? 503 : 200,
    body: {
      status: anyFailed ? 'error' : 'ok',
      checks,
    },
  };
}
