import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(here, '../../../../tests/fixtures/simple-app');

function readFixture(name: string): string {
  return readFileSync(resolve(FIXTURE_DIR, name), 'utf8');
}

const FIXTURE_HTML = readFixture('index.html');
const APP_HUB = readFixture('app-hub.html');
const APP_LOGIN = readFixture('app-login.html');
const APP_DASHBOARD = readFixture('app-dashboard.html');
const APP_PRODUCTS = readFixture('app-products.html');
const APP_CHECKOUT = readFixture('app-checkout.html');

export interface FixtureServer {
  url: string;
  close: () => Promise<void>;
}

export async function startFixtureServer(): Promise<FixtureServer> {
  const server: Server = createServer((req, res) => {
    const raw = req.url ?? '/';
    const [pathname] = raw.split('?', 1) as [string, ...string[]];

    if (pathname === '/' || pathname === '/index.html') {
      return html(res, FIXTURE_HTML);
    }
    if (pathname === '/api/error') {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end('{"error":"boom"}');
      return;
    }
    if (pathname === '/api/abort') {
      req.socket.destroy();
      return;
    }
    if (pathname === '/app/hub' || pathname === '/app' || pathname === '/app/') {
      return html(res, APP_HUB);
    }
    if (pathname === '/app/login') return html(res, APP_LOGIN);
    if (pathname === '/app/dashboard') return html(res, APP_DASHBOARD);
    if (pathname === '/app/products') return html(res, APP_PRODUCTS);
    if (pathname === '/app/checkout') return html(res, APP_CHECKOUT);
    if (pathname === '/app/redirect-external') {
      res.writeHead(302, { location: 'https://example.com/' });
      res.end();
      return;
    }
    if (pathname === '/app/loop-a') {
      return html(
        res,
        `<!doctype html><html><body><a href="/app/loop-b">B</a></body></html>`,
      );
    }
    if (pathname === '/app/loop-b') {
      return html(
        res,
        `<!doctype html><html><body><a href="/app/loop-a">A</a></body></html>`,
      );
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });

  await new Promise<void>((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => resolvePromise());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind fixture server');
  }

  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () =>
      new Promise((res, rej) => {
        server.close((err) => (err ? rej(err) : res()));
      }),
  };
}

function html(
  res: import('node:http').ServerResponse,
  body: string,
): void {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
}
