## Session 2026-10-28 — rate limiter refactor
User: refactor the limiter into a token bucket.
Agent: Done for the core path. Open item: integration tests for burst traffic still missing; I left a TODO in limiter.test.ts.

## Session 2026-10-27 — export endpoint
User: why does /export time out?
Agent: The query does a full scan. Suggested fix: add a cursor-based pagination. Not implemented yet; needs about 2 hours.
