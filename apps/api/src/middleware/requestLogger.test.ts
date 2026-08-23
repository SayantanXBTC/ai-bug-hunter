import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { requestIdMiddleware } from './requestId.js';
import {
  redactValue,
  redactObject,
  REDACT_KEYS,
  requestLoggerMiddleware,
  setRequestLogEmitter,
  resetRequestLogEmitter,
} from './requestLogger.js';

describe('redactValue / redactObject', () => {
  it('redacts each key from REDACT_KEYS', () => {
    for (const k of REDACT_KEYS) {
      expect(redactValue(k, 'sensitive-1234')).toBe('[REDACTED]');
    }
  });

  it('leaves non-sensitive keys alone', () => {
    expect(redactValue('name', 'alice')).toBe('alice');
  });

  it('redacts nested object keys case-insensitively', () => {
    const out = redactObject({
      user: { Password: 'p', name: 'a' },
      headers: { Authorization: 'Bearer x', 'X-Api-Key': 'k' },
    });
    const s = JSON.stringify(out).toLowerCase();
    expect(s).not.toContain('bearer x');
    expect(s).not.toContain('"p"');
    expect(s).not.toContain('"password":"p"');
    expect(JSON.stringify(out)).toContain('"name":"a"');
  });
});

describe('requestLoggerMiddleware', () => {
  const captured: string[] = [];
  beforeEach(() => {
    captured.length = 0;
    setRequestLogEmitter((line) => captured.push(line));
  });
  afterEach(() => {
    resetRequestLogEmitter();
  });

  it('logs request with requestId and no sensitive substrings from body', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use(requestLoggerMiddleware);
    app.post('/api/thing', (_req, res) => {
      res.json({ ok: true });
    });

    const res = await request(app)
      .post('/api/thing')
      .set('X-Request-ID', 'req-abc-123')
      .set('Authorization', 'Bearer super-secret-token')
      .send({ password: 'hunter2', name: 'alice' });

    expect(res.headers['x-request-id']).toBe('req-abc-123');
    expect(captured.length).toBe(1);
    const line = captured[0]!;
    expect(line).toContain('"requestId":"req-abc-123"');
    expect(line).toContain('"operation":"thing"');
    expect(line).toContain('"status":200');
    // Guarantee: no header/body values leaked.
    expect(line).not.toContain('hunter2');
    expect(line).not.toContain('super-secret-token');
    expect(line.toLowerCase()).not.toContain('password');
    expect(line.toLowerCase()).not.toContain('authorization');
  });

  it('generates a UUID request id when header is invalid', async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get('/api/x', (req, res) => res.json({ id: req.requestId }));
    const res = await request(app).get('/api/x').set('X-Request-ID', 'bad id with spaces!');
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(res.headers['x-request-id']).toBe(res.body.id);
  });
});
