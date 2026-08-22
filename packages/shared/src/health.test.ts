import { describe, it, expect } from 'vitest';
import { API_SERVICE_NAME, isHealthResponse, type HealthResponse } from './health.js';

describe('HealthResponse', () => {
  it('service constant is ai-bug-hunter-api', () => {
    expect(API_SERVICE_NAME).toBe('ai-bug-hunter-api');
  });

  it('accepts a valid response', () => {
    const r: HealthResponse = { status: 'ok', service: API_SERVICE_NAME };
    expect(isHealthResponse(r)).toBe(true);
  });

  it('rejects invalid status', () => {
    expect(isHealthResponse({ status: 'nope', service: API_SERVICE_NAME })).toBe(false);
  });

  it('rejects invalid service name', () => {
    expect(isHealthResponse({ status: 'ok', service: 'other' })).toBe(false);
  });

  it('rejects null', () => {
    expect(isHealthResponse(null)).toBe(false);
  });
});
