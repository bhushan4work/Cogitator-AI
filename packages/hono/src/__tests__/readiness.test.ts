import { describe, it, expect, vi, afterEach } from 'vitest';
import type { MemoryAdapter } from '@cogitator-ai/types';
import { cogitatorApp } from '../app.js';
import type { CogitatorAppOptions } from '../types.js';

function createApp(cogitator: unknown) {
  return cogitatorApp({
    cogitator: cogitator as CogitatorAppOptions['cogitator'],
    agents: {},
    workflows: {},
    swarms: {},
  });
}

describe('Hono readiness check (/ready)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with checks.memory = ok when adapter is healthy', async () => {
    const memory = {
      provider: 'postgres',
      healthCheck: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    } as unknown as MemoryAdapter;

    const cogitator = {
      getMemory: vi.fn().mockResolvedValue(memory),
    };

    const app = createApp(cogitator);
    const res = await app.request('/ready');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'ok',
      checks: { memory: 'ok' },
    });
  });

  it('returns 200 with checks: {} when memory is unconfigured', async () => {
    const cogitator = {
      getMemory: vi.fn().mockResolvedValue(undefined),
      config: {},
    };

    const app = createApp(cogitator);
    const res = await app.request('/ready');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'ok',
      checks: {},
    });
  });

  it('returns 200 with checks.memory = unchecked when adapter lacks healthCheck()', async () => {
    const memory = {
      provider: 'custom',
    } as unknown as MemoryAdapter;

    const cogitator = {
      getMemory: vi.fn().mockResolvedValue(memory),
    };

    const app = createApp(cogitator);
    const res = await app.request('/ready');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'ok',
      checks: { memory: 'unchecked' },
    });
  });

  it('returns 503 when healthCheck returns failure and keeps /health healthy', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const memory = {
      provider: 'redis',
      healthCheck: vi.fn().mockResolvedValue({
        success: false,
        error: 'ECONNREFUSED 127.0.0.1:6379',
      }),
    } as unknown as MemoryAdapter;

    const cogitator = {
      getMemory: vi.fn().mockResolvedValue(memory),
    };

    const app = createApp(cogitator);

    const readyRes = await app.request('/ready');
    expect(readyRes.status).toBe(503);
    const body = await readyRes.json();
    expect(body).toEqual({
      status: 'error',
      checks: { memory: 'error' },
    });

    // Error details must never be exposed
    const text = JSON.stringify(body);
    expect(text).not.toContain('127.0.0.1');
    expect(text).not.toContain('ECONNREFUSED');

    // /health remains pure liveness (200 OK)
    const healthRes = await app.request('/health');
    expect(healthRes.status).toBe(200);
    expect((await healthRes.json()).status).toBe('ok');
  });

  it('returns 503 when memory is configured but connection failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const cogitator = {
      getMemory: vi.fn().mockResolvedValue(undefined),
      config: { memory: { adapter: 'postgres' } },
    };

    const app = createApp(cogitator);
    const res = await app.request('/ready');

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: 'error',
      checks: { memory: 'error' },
    });
  });

  it('returns 503 when healthCheck throws an exception', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const memory = {
      provider: 'postgres',
      healthCheck: vi.fn().mockRejectedValue(new Error('Connection lost to db.internal:5432')),
    } as unknown as MemoryAdapter;

    const cogitator = {
      getMemory: vi.fn().mockResolvedValue(memory),
    };

    const app = createApp(cogitator);
    const res = await app.request('/ready');

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({
      status: 'error',
      checks: { memory: 'error' },
    });
    expect(JSON.stringify(body)).not.toContain('db.internal');
  });

  it('returns 503 when healthCheck times out', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const memory = {
      provider: 'postgres',
      // hangs longer than 3s timeout
      healthCheck: vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 5000))),
    } as unknown as MemoryAdapter;

    const cogitator = {
      getMemory: vi.fn().mockResolvedValue(memory),
    };

    const app = createApp(cogitator);
    const res = await app.request('/ready');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: 'error',
      checks: { memory: 'error' },
    });
  }, 10000);
});
