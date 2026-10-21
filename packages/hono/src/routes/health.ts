import { Hono } from 'hono';
import { checkReadiness } from '@cogitator-ai/server-shared';
import type { HonoEnv, HealthResponse } from '../types.js';

export function createHealthRoutes(startTime: number = Date.now()): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>();

  app.get('/health', (c) => {
    const response: HealthResponse = {
      status: 'ok',
      uptime: Date.now() - startTime,
      timestamp: Date.now(),
    };
    return c.json(response);
  });

  app.get('/ready', async (c) => {
    const cogitator = c.get('cogitator')?.runtime;
    const { statusCode, body } = await checkReadiness(cogitator);
    return c.json(body, statusCode);
  });

  return app;
}
