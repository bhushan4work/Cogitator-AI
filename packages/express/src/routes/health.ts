import { Router } from 'express';
import { checkReadiness } from '@cogitator-ai/server-shared';
import type { RouteContext, HealthResponse } from '../types.js';

export function createHealthRoutes(ctx: RouteContext, startTime: number = Date.now()): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const response: HealthResponse = {
      status: 'ok',
      uptime: Date.now() - startTime,
      timestamp: Date.now(),
    };
    res.json(response);
  });

  router.get('/ready', async (_req, res) => {
    const { statusCode, body } = await checkReadiness(ctx?.cogitator);
    res.status(statusCode).json(body);
  });

  return router;
}
