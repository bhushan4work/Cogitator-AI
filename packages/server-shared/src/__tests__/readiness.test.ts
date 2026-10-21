import { describe, it, expect, vi } from 'vitest';
import type { MemoryAdapter } from '@cogitator-ai/types';
import { checkReadiness } from '../readiness';

describe('checkReadiness', () => {
  it('returns 200 with checks.memory = ok when adapter healthCheck succeeds', async () => {
    const memory = {
      provider: 'memory',
      healthCheck: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    } as unknown as MemoryAdapter;

    const target = {
      getMemory: vi.fn().mockResolvedValue(memory),
    };

    const result = await checkReadiness(target);
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      status: 'ok',
      checks: { memory: 'ok' },
    });
    expect(memory.healthCheck).toHaveBeenCalledOnce();
  });

  it('returns 503 with checks.memory = error when adapter healthCheck fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const memory = {
      provider: 'redis',
      healthCheck: vi.fn().mockResolvedValue({
        success: false,
        error: 'Redis connection lost to redis://user:secret@internal-db.prod:6379',
      }),
    } as unknown as MemoryAdapter;

    const target = {
      getMemory: vi.fn().mockResolvedValue(memory),
    };

    const result = await checkReadiness(target);
    expect(result.statusCode).toBe(503);
    expect(result.body).toEqual({
      status: 'error',
      checks: { memory: 'error' },
    });

    // Public response must never leak driver errors, hosts, passwords or ports
    const serialized = JSON.stringify(result.body);
    expect(serialized).not.toContain('redis://');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('internal-db.prod');
    expect(serialized).not.toContain('6379');

    // Server-side log records the failure
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns 200 with checks.memory = unchecked when adapter lacks healthCheck() (fail-open)', async () => {
    const memory = {
      provider: 'custom',
      // no healthCheck method
    } as unknown as MemoryAdapter;

    const target = {
      getMemory: vi.fn().mockResolvedValue(memory),
    };

    const result = await checkReadiness(target);
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      status: 'ok',
      checks: { memory: 'unchecked' },
    });
  });

  it('returns 200 with empty checks when memory is unconfigured', async () => {
    const target = {
      getMemory: vi.fn().mockResolvedValue(undefined),
      memoryConfigured: false,
    };

    const result = await checkReadiness(target);
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      status: 'ok',
      checks: {},
    });
  });

  it('returns 200 when target is null or undefined (unconfigured)', async () => {
    const result1 = await checkReadiness(null);
    expect(result1.statusCode).toBe(200);
    expect(result1.body).toEqual({ status: 'ok', checks: {} });

    const result2 = await checkReadiness(undefined);
    expect(result2.statusCode).toBe(200);
    expect(result2.body).toEqual({ status: 'ok', checks: {} });
  });

  it('returns 503 when memory is configured but failed to connect (getMemory returns undefined)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = {
      getMemory: vi.fn().mockResolvedValue(undefined),
      memoryConfigured: true,
    };

    const result = await checkReadiness(target);
    expect(result.statusCode).toBe(503);
    expect(result.body).toEqual({
      status: 'error',
      checks: { memory: 'error' },
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns 503 when memory is configured but target has no getMemory function', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = {
      memoryConfigured: true,
    };

    const result = await checkReadiness(target);
    expect(result.statusCode).toBe(503);
    expect(result.body).toEqual({
      status: 'error',
      checks: { memory: 'error' },
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns 503 when healthCheck throws an exception without leaking error details', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const memory = {
      provider: 'postgres',
      healthCheck: vi
        .fn()
        .mockRejectedValue(
          new Error('FATAL: password authentication failed for user "admin" on 10.0.0.1:5432')
        ),
    } as unknown as MemoryAdapter;

    const target = {
      getMemory: vi.fn().mockResolvedValue(memory),
    };

    const result = await checkReadiness(target);
    expect(result.statusCode).toBe(503);
    expect(result.body).toEqual({
      status: 'error',
      checks: { memory: 'error' },
    });

    const serialized = JSON.stringify(result.body);
    expect(serialized).not.toContain('FATAL');
    expect(serialized).not.toContain('10.0.0.1');
    expect(serialized).not.toContain('5432');
    expect(serialized).not.toContain('admin');

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns 503 when getMemory throws an exception', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = {
      getMemory: vi
        .fn()
        .mockRejectedValue(
          new Error('Driver init failed: dial tcp 192.168.1.100:27017: connect: connection refused')
        ),
      memoryConfigured: true,
    };

    const result = await checkReadiness(target);
    expect(result.statusCode).toBe(503);
    expect(result.body).toEqual({
      status: 'error',
      checks: { memory: 'error' },
    });

    const serialized = JSON.stringify(result.body);
    expect(serialized).not.toContain('192.168.1.100');
    expect(serialized).not.toContain('27017');

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns 503 when healthCheck times out', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const memory = {
      provider: 'redis',
      healthCheck: vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 500))),
    } as unknown as MemoryAdapter;

    const target = {
      getMemory: vi.fn().mockResolvedValue(memory),
    };

    // Use a small timeout for fast tests
    const result = await checkReadiness(target, { timeoutMs: 50 });
    expect(result.statusCode).toBe(503);
    expect(result.body).toEqual({
      status: 'error',
      checks: { memory: 'error' },
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns 503 when getMemory times out', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = {
      getMemory: vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 500))),
      memoryConfigured: true,
    };

    const result = await checkReadiness(target, { timeoutMs: 50 });
    expect(result.statusCode).toBe(503);
    expect(result.body).toEqual({
      status: 'error',
      checks: { memory: 'error' },
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('enforces a single overall deadline across getMemory and healthCheck combined', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const memory = {
      provider: 'postgres',
      healthCheck: vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 40))),
    } as unknown as MemoryAdapter;

    const target = {
      // getMemory takes 30ms, healthCheck takes 40ms. Each is < 50ms, but combined (70ms) exceeds 50ms.
      getMemory: vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(memory), 30))),
    };

    const result = await checkReadiness(target, { timeoutMs: 50 });
    expect(result.statusCode).toBe(503);
    expect(result.body).toEqual({
      status: 'error',
      checks: { memory: 'error' },
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('shares pending in-flight healthCheck across concurrent readiness probes', async () => {
    let resolveCheck!: (val: { success: boolean; data: undefined }) => void;
    const delayedCheck = new Promise<{ success: boolean; data: undefined }>((resolve) => {
      resolveCheck = resolve;
    });
    const memory = {
      provider: 'redis',
      healthCheck: vi.fn().mockReturnValue(delayedCheck),
    } as unknown as MemoryAdapter;

    const target = {
      getMemory: vi.fn().mockResolvedValue(memory),
    };

    const probe1 = checkReadiness(target);
    const probe2 = checkReadiness(target);

    await Promise.resolve();
    await Promise.resolve();

    expect(memory.healthCheck).toHaveBeenCalledOnce();

    resolveCheck({ success: true, data: undefined });
    const [res1, res2] = await Promise.all([probe1, probe2]);

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
    expect(res1.body.checks.memory).toBe('ok');
    expect(res2.body.checks.memory).toBe('ok');
  });

  it('does not mutate already-returned response when health check completes after timeout', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let resolveLateCheck!: (val: { success: boolean; data: undefined }) => void;
    const latePromise = new Promise<{ success: boolean; data: undefined }>((resolve) => {
      resolveLateCheck = resolve;
    });

    const memory = {
      provider: 'postgres',
      healthCheck: vi.fn().mockReturnValue(latePromise),
    } as unknown as MemoryAdapter;

    const target = {
      getMemory: vi.fn().mockResolvedValue(memory),
    };

    const result = await checkReadiness(target, { timeoutMs: 30 });
    expect(result.statusCode).toBe(503);
    expect(result.body.checks.memory).toBe('error');

    // Health check resolves after the readiness check has already returned
    resolveLateCheck({ success: true, data: undefined });
    await latePromise;
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Response must not be mutated
    expect(result.body.checks.memory).toBe('error');
    expect(result.body.status).toBe('error');

    errorSpy.mockRestore();
  });

  it('preserves target as this context when invoking getMemory', async () => {
    const memory = {
      provider: 'memory',
      healthCheck: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    } as unknown as MemoryAdapter;

    const target = {
      underlyingMemory: memory,
      async getMemory() {
        return this.underlyingMemory;
      },
    };

    const result = await checkReadiness(target);
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      status: 'ok',
      checks: { memory: 'ok' },
    });
  });
});
