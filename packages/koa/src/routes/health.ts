import Router from '@koa/router';
import { checkReadiness } from '@cogitator-ai/server-shared';
import type { CogitatorState, HealthResponse } from '../types.js';

export function createHealthRoutes(): Router<CogitatorState> {
  const router = new Router<CogitatorState>();

  router.get('/health', (ctx) => {
    const response: HealthResponse = {
      status: 'ok',
      uptime: Math.round(process.uptime() * 1000),
      timestamp: Date.now(),
    };
    ctx.body = response;
  });

  router.get('/ready', async (ctx) => {
    const cogitator = ctx.state?.cogitator?.runtime;
    const { statusCode, body } = await checkReadiness(cogitator);
    ctx.status = statusCode;
    ctx.body = body;
  });

  return router;
}
