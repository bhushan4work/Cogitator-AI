import type { MemoryAdapter, MemoryResult } from '@cogitator-ai/types';

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
  readonly memoryConfigured?: boolean;
}

export interface ReadinessOptions {
  timeoutMs?: number;
}

export const DEFAULT_READINESS_TIMEOUT_MS = 3000;

const inFlightHealthChecks = new WeakMap<object, Promise<MemoryResult<void>>>();

function runSingleFlightHealthCheck(
  memory: MemoryAdapter & { healthCheck: () => Promise<MemoryResult<void>> }
): Promise<MemoryResult<void>> {
  const existing = inFlightHealthChecks.get(memory);
  if (existing) {
    return existing;
  }
  const promise = (async () => {
    try {
      return await memory.healthCheck();
    } finally {
      inFlightHealthChecks.delete(memory);
    }
  })();
  inFlightHealthChecks.set(memory, promise);
  return promise;
}

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
 * Enforces a single 3-second deadline for the entire memory readiness check. Adapters without
 * healthCheck() report 'unchecked' and do not fail readiness. Unconfigured memory is not
 * treated as a connection failure. Returns HTTP 200 when no checks fail, and 503 when any
 * check fails.
 */
export async function checkReadiness(
  target?: ReadinessTarget | null,
  options: ReadinessOptions = {}
): Promise<ReadinessResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS;
  const checks: Record<string, ReadinessCheckStatus> = {};

  const getMemory = target?.getMemory;
  if (getMemory) {
    try {
      const memoryStatus = await withTimeout(
        (async (): Promise<ReadinessCheckStatus | undefined> => {
          const memory = await getMemory.call(target);
          if (!memory) {
            if (target.memoryConfigured) {
              console.error('[readiness] Configured memory adapter failed to connect');
              return 'error';
            }
            return undefined;
          }
          if (typeof memory.healthCheck === 'function') {
            const result = await runSingleFlightHealthCheck(
              memory as MemoryAdapter & { healthCheck: () => Promise<MemoryResult<void>> }
            );
            if (result?.success) {
              return 'ok';
            }
            console.error(
              '[readiness] Memory healthCheck failed:',
              result?.error ?? 'Unknown error'
            );
            return 'error';
          }
          return 'unchecked';
        })(),
        timeoutMs,
        'Memory readiness check timed out'
      );
      if (memoryStatus) {
        checks.memory = memoryStatus;
      }
    } catch (err) {
      console.error(
        '[readiness] Memory check error:',
        err instanceof Error ? err.message : String(err)
      );
      checks.memory = 'error';
    }
  } else if (target?.memoryConfigured) {
    console.error('[readiness] Configured memory adapter is not initialized');
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
