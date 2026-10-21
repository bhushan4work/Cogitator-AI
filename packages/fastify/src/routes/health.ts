import type { FastifyPluginAsync } from 'fastify';
import { checkReadiness } from '@cogitator-ai/server-shared';
import type { HealthResponse } from '../types.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  const startTime = Date.now();

  fastify.get('/health', async () => {
    const response: HealthResponse = {
      status: 'ok',
      uptime: Date.now() - startTime,
      timestamp: Date.now(),
    };
    return response;
  });

  fastify.get('/ready', async (_request, reply) => {
    const { statusCode, body } = await checkReadiness(fastify.cogitator?.runtime);
    return reply.status(statusCode).send(body);
  });
};
