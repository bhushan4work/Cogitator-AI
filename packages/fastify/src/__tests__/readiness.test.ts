import { describe, it, expect, vi, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { MemoryAdapter } from '@cogitator-ai/types';
import { cogitatorPlugin } from '../plugin.js';
import type { CogitatorPluginOptions } from '../types.js';

async function createServer(cogitator: unknown): Promise<FastifyInstance> {
  const fastify = Fastify();
  await fastify.register(cogitatorPlugin, {
    cogitator: cogitator as CogitatorPluginOptions['cogitator'],
    prefix: '',
  });
  await fastify.ready();
  return fastify;
}

describe('Fastify readiness check (/ready)', () => {
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

    const server = await createServer(cogitator);
    const res = await server.inject({ method: 'GET', url: '/ready' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: 'ok',
      checks: { memory: 'ok' },
    });
  });

  it('returns 200 with checks: {} when memory is unconfigured', async () => {
    const cogitator = {
      getMemory: vi.fn().mockResolvedValue(undefined),
      config: {},
    };

    const server = await createServer(cogitator);
    const res = await server.inject({ method: 'GET', url: '/ready' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
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

    const server = await createServer(cogitator);
    const res = await server.inject({ method: 'GET', url: '/ready' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
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

    const server = await createServer(cogitator);

    const readyRes = await server.inject({ method: 'GET', url: '/ready' });
    expect(readyRes.statusCode).toBe(503);
    expect(readyRes.json()).toEqual({
      status: 'error',
      checks: { memory: 'error' },
    });

    // Error details must never be exposed
    expect(readyRes.payload).not.toContain('127.0.0.1');
    expect(readyRes.payload).not.toContain('ECONNREFUSED');

    // /health remains pure liveness (200 OK)
    const healthRes = await server.inject({ method: 'GET', url: '/health' });
    expect(healthRes.statusCode).toBe(200);
    expect(healthRes.json().status).toBe('ok');
  });

  it('returns 503 when memory is configured but connection failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const cogitator = {
      getMemory: vi.fn().mockResolvedValue(undefined),
      config: { memory: { adapter: 'postgres' } },
    };

    const server = await createServer(cogitator);
    const res = await server.inject({ method: 'GET', url: '/ready' });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({
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

    const server = await createServer(cogitator);
    const res = await server.inject({ method: 'GET', url: '/ready' });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({
      status: 'error',
      checks: { memory: 'error' },
    });
    expect(res.payload).not.toContain('db.internal');
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

    const server = await createServer(cogitator);
    const res = await server.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({
      status: 'error',
      checks: { memory: 'error' },
    });
  }, 10000);
});
