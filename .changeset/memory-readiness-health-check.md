---
'@cogitator-ai/types': minor
'@cogitator-ai/memory': minor
'@cogitator-ai/core': minor
'@cogitator-ai/server-shared': minor
'@cogitator-ai/express': minor
'@cogitator-ai/fastify': minor
'@cogitator-ai/hono': minor
'@cogitator-ai/koa': minor
'@cogitator-ai/test-utils': minor
---

Readiness checks and memory adapter health check contract (#103).

- Add optional `healthCheck(): Promise<MemoryResult<void>>` to `MemoryAdapter` in `@cogitator-ai/types` and implement it for all five built-in memory adapters (in-memory, redis, postgres, sqlite, mongodb) using lightweight, non-mutating checks.
- Add shared readiness check logic in `@cogitator-ai/server-shared` with a 3-second timeout per check. Adapters without `healthCheck()` report `unchecked` and fail open, and unconfigured memory does not fail readiness.
- Update Express, Fastify, Hono, and Koa server adapters to check readiness against memory, returning HTTP 200 when ready and HTTP 503 on failure without exposing internal driver or network details.
- Add `health-check` scenario to memory adapter conformance suite in `@cogitator-ai/test-utils`.
- Update OpenAPI specification for `/ready` endpoint with `ReadinessResponse` schema.
