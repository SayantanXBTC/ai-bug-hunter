import express, { type Express, type Request } from 'express';

export type DemoMode = 'normal' | 'buggy' | 'flaky';

export interface DemoAppOptions {
  mode?: DemoMode;
  allowRuntimeModeSwitch?: boolean;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

const DEMO_USER_EMAIL = 'demo@example.com';
const DEMO_USER_PASSWORD = 'demo1234';

const CATALOG: Record<string, { id: string; name: string; price: number }> = {
  'sku-1': { id: 'sku-1', name: 'Widget', price: 9.99 },
  'sku-2': { id: 'sku-2', name: 'Gadget', price: 19.5 },
  'sku-broken': { id: 'sku-broken', name: 'Broken Item', price: 4.5 },
};

function baseLayout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
body{font-family:system-ui,Arial,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#222;background:#fafafa}
h1{border-bottom:1px solid #ddd;padding-bottom:.4rem}
nav a{margin-right:.75rem}
form{display:flex;flex-direction:column;gap:.5rem;max-width:360px;margin:1rem 0}
input,select,button{padding:.5rem;font-size:1rem}
button{background:#1f6feb;color:#fff;border:0;cursor:pointer;border-radius:4px}
button:hover{background:#1a5ecc}
.badge{display:inline-block;padding:.15rem .5rem;border-radius:.5rem;background:#eee;font-size:.8rem}
.err{color:#b00020}
</style>
</head>
<body>
<nav>
  <a href="/">Home</a>
  <a href="/login">Login</a>
  <a href="/dashboard">Dashboard</a>
  <a href="/products">Products</a>
  <a href="/cart">Cart</a>
  <a href="/checkout">Checkout</a>
  <a href="/profile">Profile</a>
</nav>
${body}
</body></html>`;
}

/**
 * Deterministic per-query counter for BUG-4 (flaky search).
 * Every 3rd request to /search for a given `q` returns 500.
 * State is process-lifetime — resets on restart. This is intentional and
 * documented so tests can rely on the pattern within a single run.
 */
export function createDemoApp(opts: DemoAppOptions = {}): Express {
  let currentMode: DemoMode = opts.mode ?? 'normal';
  const allowRuntimeSwitch = opts.allowRuntimeModeSwitch ?? false;

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Per-process in-memory cart keyed by a simple cookie-less "session" id from header or default.
  const carts = new Map<string, CartItem[]>();
  const getCart = (id: string): CartItem[] => {
    const existing = carts.get(id);
    if (existing) return existing;
    const created: CartItem[] = [];
    carts.set(id, created);
    return created;
  };
  const sessionId = (req: Request): string => {
    const raw = req.header('x-demo-session');
    return typeof raw === 'string' && raw.length > 0 ? raw : 'default';
  };

  // BUG-4 flaky counter
  const searchCounters = new Map<string, number>();

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, mode: currentMode });
  });

  app.get('/__mode', (_req, res) => {
    res.json({ mode: currentMode });
  });

  app.post('/__mode', (req, res) => {
    if (!allowRuntimeSwitch) {
      res.status(403).json({ error: 'runtime mode switch disabled' });
      return;
    }
    const requested = (req.body as { mode?: string } | undefined)?.mode;
    if (requested !== 'normal' && requested !== 'buggy' && requested !== 'flaky') {
      res.status(400).json({ error: 'invalid mode' });
      return;
    }
    currentMode = requested;
    res.json({ mode: currentMode });
  });

  // Home
  app.get('/', (_req, res) => {
    res.type('html').send(
      baseLayout(
        'Demo App',
        `<h1>Demo Application</h1>
<p>Mode: <span class="badge" id="mode-badge">${currentMode}</span></p>
<p>Deterministic demo target for AI Bug Hunter.</p>`,
      ),
    );
  });

  // Login page
  app.get('/login', (_req, res) => {
    res.type('html').send(
      baseLayout(
        'Login',
        `<h1>Login</h1>
<form method="post" action="/login">
  <label for="login-email">Email</label>
  <input id="login-email" name="email" type="email" autocomplete="username" />
  <label for="login-password">Password</label>
  <input id="login-password" name="password" type="password" autocomplete="current-password" />
  <button id="login-submit" type="submit">Sign in</button>
</form>`,
      ),
    );
  });

  app.post('/login', (req, res) => {
    const email = String((req.body as { email?: unknown }).email ?? '');
    const password = String((req.body as { password?: unknown }).password ?? '');

    if (currentMode === 'buggy' && email === DEMO_USER_EMAIL) {
      // BUG-1: any password accepted
      res.status(200).json({ ok: true, email });
      return;
    }

    if (email === DEMO_USER_EMAIL && password === DEMO_USER_PASSWORD) {
      res.status(200).json({ ok: true, email });
      return;
    }
    res.status(401).json({ ok: false, error: 'invalid credentials' });
  });

  // Dashboard
  app.get('/dashboard', (_req, res) => {
    res.type('html').send(
      baseLayout(
        'Dashboard',
        `<h1>Dashboard</h1>
<p id="welcome">Welcome to the demo dashboard.</p>
<form method="get" action="/search">
  <label for="search-input">Search</label>
  <input id="search-input" name="q" type="text" />
  <button id="search-submit" type="submit">Search</button>
</form>`,
      ),
    );
  });

  // Products
  app.get('/products', (_req, res) => {
    const rows = Object.values(CATALOG)
      .map(
        (p) =>
          `<li><span id="product-${p.id}">${p.name}</span> — $${p.price.toFixed(2)}
          <form method="post" action="/cart/add" style="display:inline">
            <input type="hidden" name="id" value="${p.id}" />
            <button id="add-${p.id}" type="submit">Add to cart</button>
          </form></li>`,
      )
      .join('');
    res.type('html').send(baseLayout('Products', `<h1>Products</h1><ul>${rows}</ul>`));
  });

  app.post('/cart/add', (req, res) => {
    const id = String((req.body as { id?: unknown }).id ?? '');
    const item = CATALOG[id];
    if (!item) {
      res.status(404).json({ error: 'unknown product' });
      return;
    }
    const cart = getCart(sessionId(req));
    const existing = cart.find((i) => i.id === id);
    if (existing) existing.quantity += 1;
    else cart.push({ ...item, quantity: 1 });
    res.status(200).json({ ok: true, cart });
  });

  // Cart with BUG-3
  app.get('/cart', (req, res) => {
    const cart = getCart(sessionId(req));
    let total = 0;
    if (currentMode === 'buggy') {
      // BUG-3: wrong total. Doubles the price and multiplies by quantity.
      total = cart.reduce((sum, i) => sum + i.price * 2 * i.quantity, 0);
    } else {
      total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    }
    if (req.accepts(['html', 'json']) === 'json') {
      res.json({ items: cart, total: Number(total.toFixed(2)) });
      return;
    }
    const rows = cart
      .map(
        (i) =>
          `<li id="cart-item-${i.id}">${i.name} x${i.quantity} — $${(i.price * i.quantity).toFixed(2)}</li>`,
      )
      .join('');
    res.type('html').send(
      baseLayout(
        'Cart',
        `<h1>Cart</h1>
<ul>${rows || '<li>empty</li>'}</ul>
<p id="cart-total">Total: $${total.toFixed(2)}</p>
<form method="post" action="/checkout"><button id="checkout-submit" type="submit">Checkout</button></form>`,
      ),
    );
  });

  // Checkout with BUG-2
  app.get('/checkout', (_req, res) => {
    res.type('html').send(
      baseLayout(
        'Checkout',
        `<h1>Checkout</h1>
<form method="post" action="/checkout">
  <label for="checkout-name">Name</label>
  <input id="checkout-name" name="name" type="text" />
  <button id="checkout-confirm" type="submit">Confirm order</button>
</form>`,
      ),
    );
  });

  app.post('/checkout', (req, res) => {
    const cart = getCart(sessionId(req));
    if (currentMode === 'buggy' && cart.some((i) => i.id === 'sku-broken')) {
      // BUG-2
      res.status(500).json({ error: 'checkout failure (sku-broken)' });
      return;
    }
    const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    // successful checkout empties the cart
    carts.set(sessionId(req), []);
    res.status(200).json({ ok: true, total: Number(total.toFixed(2)) });
  });

  // Profile
  app.get('/profile', (_req, res) => {
    res.type('html').send(
      baseLayout(
        'Profile',
        `<h1>Profile</h1>
<form method="post" action="/profile">
  <label for="profile-name">Name</label>
  <input id="profile-name" name="name" type="text" />
  <label for="profile-email">Email</label>
  <input id="profile-email" name="email" type="email" />
  <button id="profile-save" type="submit">Save</button>
</form>`,
      ),
    );
  });

  app.post('/profile', (req, res) => {
    const body = req.body as { name?: unknown; email?: unknown };
    res.status(200).json({
      ok: true,
      name: String(body.name ?? ''),
      email: String(body.email ?? ''),
    });
  });

  // Search — BUG-4 (flaky, deterministic counter per q)
  app.get('/search', (req, res) => {
    const q = String((req.query.q as string | undefined) ?? '');
    if (currentMode === 'flaky') {
      const next = (searchCounters.get(q) ?? 0) + 1;
      searchCounters.set(q, next);
      if (next % 3 === 0) {
        res.status(500).json({ error: 'flaky search failure', q, sequence: next });
        return;
      }
    }
    res.status(200).json({ q, results: [] });
  });

  // Slow — BUG-5 (only when buggy)
  app.get('/slow', async (_req, res) => {
    if (currentMode === 'buggy') {
      await new Promise((r) => setTimeout(r, 15_000));
    }
    res.status(200).json({ ok: true });
  });

  return app;
}

const isMain = (() => {
  try {
    const argv1 = process.argv[1];
    if (!argv1) return false;
    const url = new URL(import.meta.url).pathname.replace(/^\//, '');
    return argv1.replace(/\\/g, '/').endsWith(url.split('/').pop() ?? '');
  } catch {
    return false;
  }
})();

if (isMain) {
  const port = Number(process.env.DEMO_PORT ?? 4000);
  const modeRaw = (process.env.DEMO_MODE ?? 'normal').toLowerCase();
  const mode: DemoMode =
    modeRaw === 'buggy' || modeRaw === 'flaky' ? (modeRaw as DemoMode) : 'normal';
  const allowRuntimeModeSwitch =
    (process.env.DEMO_ALLOW_RUNTIME_MODE_SWITCH ?? '').toLowerCase() === 'true';
  const app = createDemoApp({ mode, allowRuntimeModeSwitch });
  app.listen(port, () => {
     
    console.log(`[demo-app] listening on http://localhost:${port} mode=${mode}`);
  });
}
