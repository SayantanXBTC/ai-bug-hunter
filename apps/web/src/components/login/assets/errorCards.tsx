/**
 * Curated failure/error visualisations for the login image stream.
 *
 * Each card is a visually distinct SVG composition — different layouts,
 * different palettes, different chrome. All inline SVG, no external
 * assets, no licensing concerns. Centralised so cards can be replaced
 * or expanded without touching motion logic.
 */
import type { JSX, ReactNode } from 'react';

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

const W = 240;
const H = 150;

interface CardProps {
  className?: string;
}

function Wrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

/* ─────────── 1. TERMINAL STACK TRACE ─────────── */
function StackTraceCard(): JSX.Element {
  return (
    <Wrap>
      <g>
        <rect x={0} y={0} width={W} height={H} rx={10} fill="#0a0812" stroke="rgba(139,92,246,0.18)" />
        <rect x={0} y={0} width={W} height={22} rx={10} fill="#12101c" />
        <rect x={0} y={12} width={W} height={10} fill="#12101c" />
        <circle cx={12} cy={11} r={3} fill="#ef4444" />
        <circle cx={22} cy={11} r={3} fill="#f59e0b" />
        <circle cx={32} cy={11} r={3} fill="#22c55e" />
        <text x={W - 8} y={14} fill="#64748b" fontFamily="ui-monospace, monospace" fontSize={7} textAnchor="end">
          bash · error.log
        </text>
        <g fontFamily="ui-monospace, monospace" fontSize={8}>
          <text x={10} y={40} fill="#22c55e">$</text>
          <text x={20} y={40} fill="#e5e7eb">npm run test</text>
          <text x={10} y={56} fill="#ef4444">✗ Error:</text>
          <text x={52} y={56} fill="#fca5a5">Cannot read 'id' of null</text>
          <text x={10} y={72} fill="#64748b">  at UserService.get (user.ts:42:12)</text>
          <text x={10} y={86} fill="#64748b">  at Router.handle (router.ts:118)</text>
          <text x={10} y={100} fill="#64748b">  at Layer.handle_request (layer.ts)</text>
          <text x={10} y={114} fill="#475569">  at next (route.ts:137:13)</text>
          <text x={10} y={132} fill="#ef4444">exit code 1</text>
          <rect x={68} y={126} width={7} height={9} fill="#ef4444">
            <animate attributeName="opacity" values="0;1;0" dur="1s" repeatCount="indefinite" />
          </rect>
        </g>
      </g>
    </Wrap>
  );
}

/* ─────────── 2. HTTP 500 GAUGE ─────────── */
function Http500Card(): JSX.Element {
  return (
    <Wrap>
      <defs>
        <radialGradient id="c500-glow" cx="50%" cy="60%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#0a0812" stroke="rgba(239,68,68,0.35)" />
      <rect x={0} y={0} width={W} height={H} rx={10} fill="url(#c500-glow)" />
      <text x={12} y={22} fill="#f87171" fontFamily="ui-monospace, monospace" fontSize={8} fontWeight={600}>
        ⚠ INTERNAL SERVER ERROR
      </text>
      <text x={W / 2} y={82} fill="#ef4444" fontSize={54} fontFamily="ui-monospace, monospace" fontWeight={700} textAnchor="middle">
        500
      </text>
      {/* speedometer arc */}
      <g transform={`translate(${W / 2}, 118)`}>
        <path d="M -60 0 A 60 60 0 0 1 60 0" fill="none" stroke="#1e293b" strokeWidth={3} />
        <path d="M -60 0 A 60 60 0 0 1 50 -33" fill="none" stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />
        <circle cx={0} cy={0} r={3} fill="#f87171" />
      </g>
      <text x={W / 2} y={140} fill="#94a3b8" fontFamily="ui-monospace, monospace" fontSize={7} textAnchor="middle">
        POST /api/checkout · 4.2s
      </text>
    </Wrap>
  );
}

/* ─────────── 3. HTTP 404 TORN PAGE ─────────── */
function Http404Card(): JSX.Element {
  return (
    <Wrap>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#0a0812" stroke="rgba(245,158,11,0.3)" />
      {/* torn "paper" */}
      <g transform="translate(20, 30)">
        <path
          d="M 0 0 L 200 0 L 200 60 L 180 65 L 160 60 L 140 68 L 120 62 L 100 66 L 80 60 L 60 68 L 40 62 L 20 66 L 0 60 Z"
          fill="#1a1626"
          stroke="rgba(255,255,255,0.05)"
        />
        <line x1={10} y1={16} x2={90} y2={16} stroke="#334155" strokeWidth={2} />
        <line x1={10} y1={28} x2={140} y2={28} stroke="#334155" strokeWidth={2} />
        <line x1={10} y1={40} x2={70} y2={40} stroke="#334155" strokeWidth={2} />
      </g>
      <text x={W / 2} y={116} fill="#f59e0b" fontSize={26} fontFamily="ui-monospace, monospace" fontWeight={700} textAnchor="middle">
        404
      </text>
      <text x={W / 2} y={134} fill="#94a3b8" fontFamily="ui-monospace, monospace" fontSize={8} textAnchor="middle">
        Route not found
      </text>
    </Wrap>
  );
}

/* ─────────── 4. TEST REPORT GRID ─────────── */
function TestReportCard(): JSX.Element {
  // 6x3 grid of squares, pass/fail deterministic
  const results = [
    'P', 'P', 'P', 'F', 'P', 'P',
    'P', 'F', 'P', 'P', 'P', 'F',
    'P', 'P', 'P', 'P', 'F', 'P',
  ];
  return (
    <Wrap>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#0a0812" stroke="rgba(139,92,246,0.25)" />
      <text x={12} y={22} fill="#a78bfa" fontFamily="ui-monospace, monospace" fontSize={9} fontWeight={600}>
        TEST SUITE
      </text>
      <text x={W - 12} y={22} fill="#94a3b8" fontFamily="ui-monospace, monospace" fontSize={9} textAnchor="end">
        14/18 passed
      </text>
      <g transform="translate(12, 34)">
        {results.map((r, i) => {
          const col = i % 6;
          const row = Math.floor(i / 6);
          const passed = r === 'P';
          return (
            <rect
              key={i}
              x={col * 37}
              y={row * 26}
              width={32}
              height={20}
              rx={3}
              fill={passed ? '#065f46' : '#7f1d1d'}
              stroke={passed ? '#10b981' : '#ef4444'}
              strokeWidth={0.8}
              opacity={0.85}
            />
          );
        })}
      </g>
      <text x={12} y={140} fill="#f87171" fontFamily="ui-monospace, monospace" fontSize={7}>
        4 failed · checkout, cart-total, +2
      </text>
    </Wrap>
  );
}

/* ─────────── 5. CONSOLE DEVTOOLS ─────────── */
function ConsoleErrorCard(): JSX.Element {
  return (
    <Wrap>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#0a0812" stroke="rgba(239,68,68,0.25)" />
      <rect x={0} y={0} width={W} height={20} fill="#12101c" />
      <text x={12} y={13} fill="#94a3b8" fontFamily="ui-monospace, monospace" fontSize={8}>
        Console
      </text>
      <text x={54} y={13} fill="#ef4444" fontFamily="ui-monospace, monospace" fontSize={8}>
        Errors (3)
      </text>
      <text x={100} y={13} fill="#64748b" fontFamily="ui-monospace, monospace" fontSize={8}>
        Warnings
      </text>
      <g transform="translate(0, 28)">
        <rect x={0} y={0} width={W} height={30} fill="rgba(239,68,68,0.08)" />
        <text x={10} y={12} fill="#ef4444" fontFamily="ui-monospace, monospace" fontSize={8}>
          ⊗ Uncaught TypeError
        </text>
        <text x={10} y={24} fill="#f87171" fontFamily="ui-monospace, monospace" fontSize={7}>
          cart.items.map is not a function
        </text>
        <text x={W - 10} y={12} fill="#64748b" fontFamily="ui-monospace, monospace" fontSize={7} textAnchor="end">
          cart.tsx:24
        </text>
      </g>
      <g transform="translate(0, 62)">
        <rect x={0} y={0} width={W} height={22} fill="rgba(239,68,68,0.05)" />
        <text x={10} y={14} fill="#f87171" fontFamily="ui-monospace, monospace" fontSize={7}>
          ⊗ Network request failed (POST /api/checkout)
        </text>
      </g>
      <g transform="translate(0, 88)">
        <rect x={0} y={0} width={W} height={22} fill="rgba(245,158,11,0.05)" />
        <text x={10} y={14} fill="#fbbf24" fontFamily="ui-monospace, monospace" fontSize={7}>
          ⚠ Slow response · 4.2s /api/orders
        </text>
      </g>
      <text x={10} y={132} fill="#64748b" fontFamily="ui-monospace, monospace" fontSize={7}>
        Filter: is:error
      </text>
      <rect x={68} y={125} width={4} height={9} fill="#64748b">
        <animate attributeName="opacity" values="1;0;1" dur="0.8s" repeatCount="indefinite" />
      </rect>
    </Wrap>
  );
}

/* ─────────── 6. BROKEN UI MOCKUP ─────────── */
function BrokenUiCard(): JSX.Element {
  return (
    <Wrap>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#0a0812" stroke="rgba(59,130,246,0.25)" />
      {/* fake browser chrome */}
      <rect x={0} y={0} width={W} height={18} fill="#12101c" rx={10} />
      <rect x={0} y={8} width={W} height={10} fill="#12101c" />
      <circle cx={9} cy={9} r={2.5} fill="#64748b" />
      <circle cx={17} cy={9} r={2.5} fill="#64748b" />
      <circle cx={25} cy={9} r={2.5} fill="#64748b" />
      <rect x={38} y={5} width={190} height={8} rx={3} fill="#1e293b" />
      <text x={44} y={11} fill="#475569" fontFamily="ui-monospace, monospace" fontSize={6}>
        shop.example.com/checkout
      </text>
      {/* broken page */}
      <g transform="translate(0, 22)">
        <rect x={12} y={4} width={80} height={8} rx={2} fill="#334155" />
        <rect x={12} y={18} width={200} height={6} rx={2} fill="#1e293b" />
        <rect x={12} y={28} width={160} height={6} rx={2} fill="#1e293b" />
        {/* crashed component */}
        <g transform="translate(12, 42)">
          <rect x={0} y={0} width={216} height={60} rx={4} fill="rgba(239,68,68,0.08)" stroke="#ef4444" strokeDasharray="4 3" />
          <path d="M 108 12 L 108 32" stroke="#ef4444" strokeWidth={2} />
          <circle cx={108} cy={40} r={2} fill="#ef4444" />
          <text x={108} y={54} fill="#f87171" fontFamily="ui-monospace, monospace" fontSize={7} textAnchor="middle">
            &lt;CheckoutForm/&gt; failed to render
          </text>
        </g>
      </g>
    </Wrap>
  );
}

/* ─────────── 7. CODE EDITOR ─────────── */
function CodeErrorCard(): JSX.Element {
  return (
    <Wrap>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#0a0812" stroke="rgba(139,92,246,0.2)" />
      {/* gutter */}
      <rect x={0} y={0} width={26} height={H} fill="#12101c" rx={10} />
      <rect x={0} y={0} width={26} height={H} fill="#12101c" />
      <g fontFamily="ui-monospace, monospace" fontSize={8}>
        {[41, 42, 43, 44, 45, 46, 47, 48].map((n, i) => (
          <text
            key={n}
            x={18}
            y={22 + i * 15}
            fill={i === 3 ? '#ef4444' : '#475569'}
            textAnchor="end"
          >
            {n}
          </text>
        ))}
      </g>
      <g fontFamily="ui-monospace, monospace" fontSize={8}>
        <text x={32} y={22} fill="#94a3b8">
          <tspan fill="#a78bfa">async function</tspan>
          <tspan fill="#93c5fd"> getUser</tspan>
          <tspan>(id) {'{'}</tspan>
        </text>
        <text x={32} y={37} fill="#94a3b8">
          {'  '}
          <tspan fill="#a78bfa">const</tspan>
          <tspan> user = </tspan>
          <tspan fill="#a78bfa">await</tspan>
        </text>
        <text x={32} y={52} fill="#94a3b8">
          {'    '}db.query(
          <tspan fill="#fbbf24">"SELECT *"</tspan>
          );
        </text>
        <text x={32} y={67} fill="#94a3b8">
          {'  '}
          <tspan fill="#a78bfa">return</tspan>
          <tspan> user.rows[</tspan>
          <tspan fill="#f59e0b">0</tspan>
          <tspan>];</tspan>
        </text>
        <path d="M 78 68 Q 84 72 90 68 T 102 68 T 114 68 T 126 68" stroke="#ef4444" strokeWidth={0.8} fill="none" />
        <text x={32} y={82} fill="#94a3b8">{'}'}</text>
      </g>
      {/* inline error tooltip */}
      <g transform="translate(30, 92)">
        <rect x={0} y={0} width={200} height={40} rx={4} fill="#7f1d1d" fillOpacity={0.35} stroke="#ef4444" />
        <text x={8} y={14} fill="#f87171" fontFamily="ui-monospace, monospace" fontSize={7}>
          TypeError: Cannot read 'rows'
        </text>
        <text x={8} y={26} fill="#fca5a5" fontFamily="ui-monospace, monospace" fontSize={7}>
          of undefined
        </text>
        <text x={8} y={36} fill="#94a3b8" fontFamily="ui-monospace, monospace" fontSize={6}>
          user.ts:44 · problems (1)
        </text>
      </g>
    </Wrap>
  );
}

/* ─────────── 8. HTTP REQUEST/RESPONSE ─────────── */
function ApiFailureCard(): JSX.Element {
  return (
    <Wrap>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#0a0812" stroke="rgba(239,68,68,0.25)" />
      <g fontFamily="ui-monospace, monospace" fontSize={8}>
        {/* request */}
        <rect x={0} y={0} width={W} height={20} fill="#12101c" />
        <text x={10} y={13} fill="#22c55e" fontWeight={700}>POST</text>
        <text x={40} y={13} fill="#e5e7eb">/api/orders</text>
        <text x={W - 10} y={13} fill="#ef4444" textAnchor="end">502</text>
        <line x1={0} y1={30} x2={W} y2={30} stroke="#1e293b" />
        <text x={10} y={44} fill="#94a3b8">→ request</text>
        <text x={10} y={58} fill="#64748b">Content-Type: application/json</text>
        <text x={10} y={72} fill="#64748b">{'{"items":[{"sku":"broken"}]}'}</text>
        <line x1={0} y1={82} x2={W} y2={82} stroke="#1e293b" />
        <text x={10} y={96} fill="#f87171">← response</text>
        <text x={10} y={110} fill="#94a3b8">{'{'}</text>
        <text x={10} y={122} fill="#94a3b8">
          {'  '}
          <tspan fill="#a78bfa">"error"</tspan>
          : <tspan fill="#fbbf24">"BAD_GATEWAY"</tspan>
        </text>
        <text x={10} y={134} fill="#94a3b8">
          {'  '}
          <tspan fill="#a78bfa">"upstream"</tspan>
          : <tspan fill="#fbbf24">"payment-svc"</tspan>
        </text>
        <text x={10} y={146} fill="#94a3b8">{'}'}</text>
      </g>
    </Wrap>
  );
}

/* ─────────── 9. TYPE ERROR DIALOG ─────────── */
function TypeErrorCard(): JSX.Element {
  return (
    <Wrap>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#0a0812" />
      {/* modal alert */}
      <g transform="translate(20, 24)">
        <rect x={0} y={0} width={200} height={102} rx={6} fill="#12101c" stroke="#ef4444" />
        {/* icon */}
        <circle cx={20} cy={22} r={12} fill="#7f1d1d" stroke="#ef4444" />
        <text x={20} y={26} fill="#fca5a5" fontFamily="ui-monospace, monospace" fontSize={14} fontWeight={700} textAnchor="middle">
          !
        </text>
        <text x={40} y={17} fill="#f87171" fontFamily="ui-monospace, monospace" fontSize={9} fontWeight={600}>
          TypeError
        </text>
        <text x={40} y={30} fill="#94a3b8" fontFamily="ui-monospace, monospace" fontSize={7}>
          Uncaught runtime exception
        </text>
        <line x1={12} y1={44} x2={188} y2={44} stroke="#1e293b" />
        <text x={12} y={62} fill="#e5e7eb" fontFamily="ui-monospace, monospace" fontSize={8}>
          Cannot destructure property
        </text>
        <text x={12} y={76} fill="#e5e7eb" fontFamily="ui-monospace, monospace" fontSize={8}>
          <tspan fill="#fbbf24">'name'</tspan> of undefined
        </text>
        {/* buttons */}
        <rect x={110} y={82} width={38} height={14} rx={3} fill="#1e293b" />
        <text x={129} y={92} fill="#94a3b8" fontFamily="ui-monospace, monospace" fontSize={7} textAnchor="middle">
          Dismiss
        </text>
        <rect x={152} y={82} width={38} height={14} rx={3} fill="#ef4444" />
        <text x={171} y={92} fill="#fff" fontFamily="ui-monospace, monospace" fontSize={7} textAnchor="middle">
          Report
        </text>
      </g>
    </Wrap>
  );
}

/* ─────────── 10. TIMEOUT SPINNER ─────────── */
function TimeoutCard(): JSX.Element {
  return (
    <Wrap>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#0a0812" stroke="rgba(245,158,11,0.3)" />
      <text x={12} y={22} fill="#f59e0b" fontFamily="ui-monospace, monospace" fontSize={9} fontWeight={600}>
        ⌛ TIMEOUT
      </text>
      <text x={W - 12} y={22} fill="#94a3b8" fontFamily="ui-monospace, monospace" fontSize={8} textAnchor="end">
        10.02s / 10.00s
      </text>
      {/* clock */}
      <g transform={`translate(${W / 2}, 76)`}>
        <circle r={26} fill="none" stroke="#334155" strokeWidth={2} />
        <circle r={26} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="163 163" strokeDashoffset={12} transform="rotate(-90)" />
        <line x1={0} y1={0} x2={0} y2={-18} stroke="#fbbf24" strokeWidth={1.5} strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4s" repeatCount="indefinite" />
        </line>
        <line x1={0} y1={0} x2={12} y2={0} stroke="#f59e0b" strokeWidth={1.5} strokeLinecap="round" />
        <circle r={2} fill="#fbbf24" />
      </g>
      <text x={W / 2} y={122} fill="#fbbf24" fontFamily="ui-monospace, monospace" fontSize={8} textAnchor="middle">
        Playwright: waiting locator
      </text>
      <text x={W / 2} y={136} fill="#64748b" fontFamily="ui-monospace, monospace" fontSize={7} textAnchor="middle">
        #submit-order · retry 2/3
      </text>
    </Wrap>
  );
}

/* ─────────── 11. DIFF VIEW ─────────── */
function AssertionFailedCard(): JSX.Element {
  return (
    <Wrap>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#0a0812" stroke="rgba(239,68,68,0.3)" />
      <text x={12} y={22} fill="#ef4444" fontFamily="ui-monospace, monospace" fontSize={9} fontWeight={600}>
        ✗ AssertionError
      </text>
      <text x={W - 12} y={22} fill="#64748b" fontFamily="ui-monospace, monospace" fontSize={7} textAnchor="end">
        cart-total.spec.ts
      </text>
      {/* diff panel */}
      <g transform="translate(12, 32)">
        <rect x={0} y={0} width={216} height={100} rx={4} fill="#12101c" stroke="#1e293b" />
        <g fontFamily="ui-monospace, monospace" fontSize={8}>
          <rect x={0} y={4} width={216} height={16} fill="rgba(34,197,94,0.08)" />
          <text x={10} y={15} fill="#22c55e">+ expected</text>
          <text x={W - 30} y={15} fill="#22c55e" textAnchor="end">19.98</text>

          <rect x={0} y={22} width={216} height={16} fill="rgba(239,68,68,0.08)" />
          <text x={10} y={33} fill="#ef4444">− received</text>
          <text x={W - 30} y={33} fill="#ef4444" textAnchor="end">39.96</text>

          <text x={10} y={54} fill="#64748b">--- cart.ts:52</text>
          <text x={10} y={68} fill="#94a3b8">total = sum(items,</text>
          <text x={20} y={80} fill="#ef4444">i {'=>'} price * qty * 2)</text>
          <text x={20} y={92} fill="#22c55e">i {'=>'} price * qty)</text>
        </g>
      </g>
    </Wrap>
  );
}

/* ─────────── 12. NETWORK WATERFALL ─────────── */
function NetworkErrorCard(): JSX.Element {
  const rows = [
    { name: 'GET /api/user', color: '#22c55e', x: 40, w: 30, status: '200' },
    { name: 'GET /api/inventory', color: '#f59e0b', x: 40, w: 130, status: '4.8s' },
    { name: 'POST /api/checkout', color: '#ef4444', x: 40, w: 50, status: 'ERR' },
    { name: 'GET /api/config', color: '#22c55e', x: 40, w: 18, status: '200' },
    { name: 'GET /api/session', color: '#22c55e', x: 40, w: 22, status: '200' },
  ];
  return (
    <Wrap>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#0a0812" stroke="rgba(59,130,246,0.25)" />
      <rect x={0} y={0} width={W} height={20} fill="#12101c" />
      <text x={10} y={13} fill="#60a5fa" fontFamily="ui-monospace, monospace" fontSize={8} fontWeight={600}>
        NETWORK
      </text>
      <text x={82} y={13} fill="#94a3b8" fontFamily="ui-monospace, monospace" fontSize={7}>
        5 requests · 1 failed
      </text>
      <g transform="translate(0, 26)">
        {rows.map((r, i) => (
          <g key={i} transform={`translate(0, ${i * 21})`}>
            <text x={8} y={12} fill="#94a3b8" fontFamily="ui-monospace, monospace" fontSize={7}>
              {r.name}
            </text>
            <rect x={r.x + 108} y={5} width={r.w} height={9} rx={1.5} fill={r.color} opacity={0.85} />
            <text
              x={W - 8}
              y={12}
              fill={r.color}
              fontFamily="ui-monospace, monospace"
              fontSize={7}
              textAnchor="end"
            >
              {r.status}
            </text>
          </g>
        ))}
      </g>
      <text x={10} y={144} fill="#f87171" fontFamily="ui-monospace, monospace" fontSize={7}>
        net::ERR_CONNECTION_RESET
      </text>
    </Wrap>
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

export const CARD_DIMENSIONS = { width: W, height: H };
