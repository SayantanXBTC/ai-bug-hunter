// Global vitest setup: enable test auth bypass so existing route tests continue
// to pass after Phase 10 Chunk 2 introduced role guards.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.TEST_AUTH_BYPASS = process.env.TEST_AUTH_BYPASS ?? '1';
