/**
 * Curated failure/error visualisations for the login image stream.
 *
 * Each card is a self-contained SVG — no external assets, no licensing
 * concerns. Rendered small (~200x140) and further scaled/blurred by
 * ImageStream. Centralised here so cards can be replaced/expanded
 * without touching motion logic.
 */
import type { JSX } from 'react';

export type ErrorCardId =
  | 'stack-trace'
  | 'http-500'
  | 'http-404'
  | 'test-report'
  | 'console-error'
  | 'broken-ui'
  | 'code-error'
  | 'api-failure'
  | 'type-error'
  | 'timeout'
  | 'assertion-failed'
  | 'network-error';

interface CardProps {
  className?: string;
}

const CARD_W = 220;
const CARD_H = 140;

function Frame({
  children,
  tint = 'rgba(139,92,246,0.15)',
}: {
  children: JSX.Element;
  tint?: string;
}): JSX.Element {
  return (
    <svg
      width={CARD_W}
      height={CARD_H}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="card-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(18,16,32,0.95)" />
          <stop offset="100%" stopColor="rgba(8,6,20,0.95)" />
        </linearGradient>
      </defs>
      <rect
        x={0.5}
        y={0.5}
        width={CARD_W - 1}
        height={CARD_H - 1}
        rx={10}
        fill="url(#card-bg)"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
      />
      <rect
        x={0.5}
        y={0.5}
        width={CARD_W - 1}
        height={20}
        rx={10}
        fill={tint}
        opacity={0.4}
      />
      <circle cx={12} cy={10} r={3} fill="#ef4444" />
      <circle cx={22} cy={10} r={3} fill="#f59e0b" />
      <circle cx={32} cy={10} r={3} fill="#22c55e" />
      {children}
    </svg>
  );
}

function StackTraceCard(): JSX.Element {
  return (
    <Frame tint="rgba(239,68,68,0.2)">
      <g fontFamily="ui-monospace, monospace" fontSize={8}>
        <text x={12} y={38} fill="#ef4444">
          Error: Cannot read property 'id' of null
        </text>
        <text x={12} y={54} fill="#94a3b8">
          at UserService.get (user.ts:42:12)
        </text>
        <text x={12} y={68} fill="#94a3b8">
          at Router.handle (router.ts:118:8)
        </text>
        <text x={12} y={82} fill="#94a3b8">
          at Layer.handle_request (layer.ts:95:5)
        </text>
        <text x={12} y={96} fill="#64748b">
          at next (route.ts:137:13)
        </text>
        <text x={12} y={110} fill="#64748b">
          at process._tickCallback
        </text>
        <text x={12} y={124} fill="#ef4444" fontSize={7}>
          [ 3 frames omitted ]
        </text>
      </g>
    </Frame>
  );
}

function Http500Card(): JSX.Element {
  return (
    <Frame tint="rgba(239,68,68,0.3)">
      <g fontFamily="ui-monospace, monospace">
        <text x={CARD_W / 2} y={72} fill="#ef4444" fontSize={40} fontWeight={700} textAnchor="middle">
          500
        </text>
        <text
          x={CARD_W / 2}
          y={94}
          fill="#f87171"
          fontSize={9}
          textAnchor="middle"
        >
          Internal Server Error
        </text>
        <text
          x={CARD_W / 2}
          y={112}
          fill="#94a3b8"
          fontSize={7}
          textAnchor="middle"
        >
          POST /api/checkout
        </text>
      </g>
    </Frame>
  );
}

function Http404Card(): JSX.Element {
  return (
    <Frame tint="rgba(245,158,11,0.25)">
      <g fontFamily="ui-monospace, monospace">
        <text x={CARD_W / 2} y={72} fill="#f59e0b" fontSize={40} fontWeight={700} textAnchor="middle">
          404
        </text>
        <text
          x={CARD_W / 2}
          y={94}
          fill="#fbbf24"
          fontSize={9}
          textAnchor="middle"
        >
          Not Found
        </text>
        <text
          x={CARD_W / 2}
          y={112}
          fill="#94a3b8"
          fontSize={7}
          textAnchor="middle"
        >
          GET /api/users/legacy
        </text>
      </g>
    </Frame>
  );
}

function TestReportCard(): JSX.Element {
  return (
    <Frame tint="rgba(139,92,246,0.25)">
      <g fontFamily="ui-monospace, monospace" fontSize={8}>
        <text x={12} y={38} fill="#a78bfa" fontSize={9}>
          Test Suite · 14/18
        </text>
        <g transform="translate(12, 50)">
          <circle cx={4} cy={4} r={3} fill="#22c55e" />
          <text x={14} y={7} fill="#e5e7eb">login accepts valid creds</text>
        </g>
        <g transform="translate(12, 64)">
          <circle cx={4} cy={4} r={3} fill="#22c55e" />
          <text x={14} y={7} fill="#e5e7eb">discovery finds 7 pages</text>
        </g>
        <g transform="translate(12, 78)">
          <circle cx={4} cy={4} r={3} fill="#ef4444" />
          <text x={14} y={7} fill="#fca5a5">checkout returns 200 · FAIL</text>
        </g>
        <g transform="translate(12, 92)">
          <circle cx={4} cy={4} r={3} fill="#ef4444" />
          <text x={14} y={7} fill="#fca5a5">cart total correct · FAIL</text>
        </g>
        <g transform="translate(12, 106)">
          <circle cx={4} cy={4} r={3} fill="#f59e0b" />
          <text x={14} y={7} fill="#fbbf24">flaky: search 3rd request</text>
        </g>
      </g>
    </Frame>
  );
}

function ConsoleErrorCard(): JSX.Element {
  return (
    <Frame tint="rgba(239,68,68,0.2)">
      <g fontFamily="ui-monospace, monospace" fontSize={8}>
        <text x={12} y={38} fill="#94a3b8">console.error</text>
        <text x={12} y={54} fill="#ef4444">Uncaught TypeError:</text>
        <text x={12} y={68} fill="#f87171">
          cart.items.map is not a function
        </text>
        <text x={12} y={86} fill="#94a3b8">at renderCart (cart.tsx:24)</text>
        <text x={12} y={100} fill="#94a3b8">at commitRoot (react-dom.js)</text>
        <text x={12} y={122} fill="#64748b">14:32:07 · 3 similar errors</text>
      </g>
    </Frame>
  );
}

function BrokenUiCard(): JSX.Element {
  return (
    <Frame tint="rgba(59,130,246,0.2)">
      <g>
        {/* fake broken UI skeleton */}
        <rect x={14} y={34} width={80} height={8} rx={2} fill="#334155" />
        <rect x={14} y={48} width={140} height={6} rx={2} fill="#1e293b" />
        <rect x={14} y={60} width={120} height={6} rx={2} fill="#1e293b" />
        <rect x={14} y={78} width={190} height={38} rx={4} fill="#1e293b" stroke="#ef4444" strokeDasharray="3 2" />
        <line x1={30} y1={78} x2={100} y2={116} stroke="#ef4444" strokeWidth={1.5} />
        <line x1={100} y1={78} x2={30} y2={116} stroke="#ef4444" strokeWidth={1.5} />
        <text
          x={CARD_W / 2}
          y={130}
          fill="#94a3b8"
          fontSize={7}
          fontFamily="ui-monospace, monospace"
          textAnchor="middle"
        >
          Component failed to render
        </text>
      </g>
    </Frame>
  );
}

function CodeErrorCard(): JSX.Element {
  return (
    <Frame tint="rgba(139,92,246,0.2)">
      <g fontFamily="ui-monospace, monospace" fontSize={8}>
        <text x={12} y={38} fill="#94a3b8">
          <tspan fill="#a78bfa">const</tspan>
          <tspan> user = </tspan>
          <tspan fill="#22c55e">await</tspan>
          <tspan> db.query(</tspan>
        </text>
        <text x={12} y={52} fill="#94a3b8">
          {'  '}
          <tspan fill="#fbbf24">"SELECT * FROM users"</tspan>
        </text>
        <text x={12} y={66} fill="#94a3b8">);</text>
        <text x={12} y={82} fill="#f87171">// ⚠ SQL injection risk</text>
        <line x1={12} y1={70} x2={120} y2={70} stroke="#ef4444" strokeWidth={0.8} strokeDasharray="2 2" />
        <text x={12} y={104} fill="#94a3b8">
          <tspan fill="#a78bfa">return</tspan>
          <tspan> user.rows[</tspan>
          <tspan fill="#f59e0b">0</tspan>
          <tspan>];</tspan>
        </text>
        <text x={12} y={122} fill="#ef4444">TypeError: rows undefined</text>
      </g>
    </Frame>
  );
}

function ApiFailureCard(): JSX.Element {
  return (
    <Frame tint="rgba(239,68,68,0.2)">
      <g fontFamily="ui-monospace, monospace" fontSize={8}>
        <text x={12} y={38} fill="#f87171">
          POST /api/orders → 502
        </text>
        <text x={12} y={54} fill="#94a3b8">{'{'}</text>
        <text x={12} y={68} fill="#94a3b8">
          {'  '}
          <tspan fill="#a78bfa">"error"</tspan>
          : {'{'}
        </text>
        <text x={12} y={82} fill="#94a3b8">
          {'    '}
          <tspan fill="#a78bfa">"code"</tspan>
          : <tspan fill="#fbbf24">"BAD_GATEWAY"</tspan>,
        </text>
        <text x={12} y={96} fill="#94a3b8">
          {'    '}
          <tspan fill="#a78bfa">"upstream"</tspan>
          : <tspan fill="#fbbf24">"payment-svc"</tspan>
        </text>
        <text x={12} y={110} fill="#94a3b8">{'  }'}</text>
        <text x={12} y={124} fill="#94a3b8">{'}'}</text>
      </g>
    </Frame>
  );
}

function TypeErrorCard(): JSX.Element {
  return (
    <Frame tint="rgba(239,68,68,0.2)">
      <g fontFamily="ui-monospace, monospace" fontSize={8}>
        <text x={12} y={40} fill="#ef4444" fontSize={9}>TypeError</text>
        <text x={12} y={58} fill="#f87171">
          Cannot destructure property
        </text>
        <text x={12} y={72} fill="#f87171">
          'name' of undefined
        </text>
        <text x={12} y={90} fill="#94a3b8">at ProductCard.render (23)</text>
        <text x={12} y={104} fill="#94a3b8">at renderWithHooks (react)</text>
        <text x={12} y={122} fill="#64748b">Occurred 47 times · 2h</text>
      </g>
    </Frame>
  );
}

function TimeoutCard(): JSX.Element {
  return (
    <Frame tint="rgba(245,158,11,0.25)">
      <g fontFamily="ui-monospace, monospace">
        <text x={CARD_W / 2} y={54} fill="#f59e0b" fontSize={11} textAnchor="middle" fontWeight={600}>
          TIMEOUT
        </text>
        <text
          x={CARD_W / 2}
          y={74}
          fill="#fbbf24"
          fontSize={9}
          textAnchor="middle"
        >
          Playwright: 10000ms exceeded
        </text>
        <text
          x={CARD_W / 2}
          y={92}
          fill="#94a3b8"
          fontSize={7}
          textAnchor="middle"
        >
          waiting for locator('#submit')
        </text>
        <g transform={`translate(${CARD_W / 2 - 30}, 100)`}>
          <rect width={60} height={4} rx={2} fill="#1e293b" />
          <rect width={54} height={4} rx={2} fill="#f59e0b" opacity={0.8} />
        </g>
        <text
          x={CARD_W / 2}
          y={124}
          fill="#94a3b8"
          fontSize={7}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
        >
          10.02s · retry 2/3
        </text>
      </g>
    </Frame>
  );
}

function AssertionFailedCard(): JSX.Element {
  return (
    <Frame tint="rgba(239,68,68,0.2)">
      <g fontFamily="ui-monospace, monospace" fontSize={8}>
        <text x={12} y={40} fill="#ef4444">AssertionError</text>
        <text x={12} y={58} fill="#94a3b8">expected:</text>
        <text x={20} y={72} fill="#22c55e">19.98</text>
        <text x={12} y={90} fill="#94a3b8">received:</text>
        <text x={20} y={104} fill="#f87171">39.96</text>
        <text x={12} y={122} fill="#64748b">cart.total × 2 quantity bug</text>
      </g>
    </Frame>
  );
}

function NetworkErrorCard(): JSX.Element {
  return (
    <Frame tint="rgba(59,130,246,0.2)">
      <g fontFamily="ui-monospace, monospace" fontSize={8}>
        <text x={12} y={40} fill="#60a5fa">Network Log</text>
        <text x={12} y={58} fill="#ef4444">
          ✗ POST /api/v2/checkout
        </text>
        <text x={22} y={72} fill="#94a3b8">
          net::ERR_CONNECTION_RESET
        </text>
        <text x={12} y={92} fill="#f59e0b">
          ⚠ GET /api/inventory · 4.8s
        </text>
        <text x={12} y={106} fill="#22c55e">
          ✓ GET /api/user · 82ms
        </text>
        <text x={12} y={124} fill="#64748b">
          3 failed · 12 pending
        </text>
      </g>
    </Frame>
  );
}

const REGISTRY: Record<ErrorCardId, () => JSX.Element> = {
  'stack-trace': StackTraceCard,
  'http-500': Http500Card,
  'http-404': Http404Card,
  'test-report': TestReportCard,
  'console-error': ConsoleErrorCard,
  'broken-ui': BrokenUiCard,
  'code-error': CodeErrorCard,
  'api-failure': ApiFailureCard,
  'type-error': TypeErrorCard,
  timeout: TimeoutCard,
  'assertion-failed': AssertionFailedCard,
  'network-error': NetworkErrorCard,
};

export const ALL_ERROR_CARDS: ErrorCardId[] = [
  'stack-trace',
  'http-500',
  'test-report',
  'console-error',
  'broken-ui',
  'code-error',
  'api-failure',
  'type-error',
  'timeout',
  'assertion-failed',
  'network-error',
  'http-404',
];

export function ErrorCard({ id, className }: { id: ErrorCardId } & CardProps): JSX.Element {
  const Component = REGISTRY[id];
  return (
    <div className={className} aria-hidden="true">
      <Component />
    </div>
  );
}

export const CARD_DIMENSIONS = { width: CARD_W, height: CARD_H };
