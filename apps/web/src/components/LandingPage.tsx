import { useEffect, useRef, useState } from 'react';

interface Props {
  isAuthenticated: boolean;
  onCta: () => void;
}

const CTA_LABEL_GUEST = 'Sign in to begin';
const CTA_LABEL_AUTH = 'Continue to dashboard';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260530_042513_df96a13b-6155-4f6e-8b93-c9dee66fba08.mp4';

const SENSITIVITY = 0.8;

function useTypewriter(text: string, speed = 38, startDelay = 600) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let idx = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startTimer = setTimeout(() => {
      intervalId = setInterval(() => {
        idx += 1;
        setDisplayed(text.slice(0, idx));
        if (idx >= text.length) {
          if (intervalId) clearInterval(intervalId);
          setDone(true);
        }
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(startTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}

function BackgroundVideo(): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const prevXRef = useRef<number | null>(null);
  const targetTimeRef = useRef<number>(0);
  const seekingRef = useRef<boolean>(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function scheduleSeek(): void {
      if (!video) return;
      if (seekingRef.current) return;
      const diff = Math.abs(video.currentTime - targetTimeRef.current);
      if (diff < 0.001) return;
      seekingRef.current = true;
      video.currentTime = targetTimeRef.current;
    }

    function handleSeeked(): void {
      seekingRef.current = false;
      if (!video) return;
      const diff = Math.abs(video.currentTime - targetTimeRef.current);
      if (diff > 0.001) scheduleSeek();
    }

    function handleMouseMove(ev: MouseEvent): void {
      if (!video) return;
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const currentX = ev.clientX;
      if (prevXRef.current === null) {
        prevXRef.current = currentX;
        return;
      }
      const delta = currentX - prevXRef.current;
      prevXRef.current = currentX;
      const timeOffset = (delta / window.innerWidth) * SENSITIVITY * video.duration;
      let next = targetTimeRef.current + timeOffset;
      if (next < 0) next = 0;
      if (next > video.duration) next = video.duration;
      targetTimeRef.current = next;
      scheduleSeek();
    }

    video.addEventListener('seeked', handleSeeked);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      video.removeEventListener('seeked', handleSeeked);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        src={VIDEO_URL}
        muted
        playsInline
        preload="auto"
        className="pointer-events-none"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          objectFit: 'cover',
          objectPosition: '70% center',
        }}
      />
      {/* Purple tint overlay — heavier on the left so hero copy stays crisp */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          zIndex: 0,
          background:
            'linear-gradient(90deg, rgba(4,4,10,0.85) 0%, rgba(13,10,32,0.7) 25%, rgba(13,10,32,0.35) 55%, rgba(4,4,10,0.2) 100%), linear-gradient(180deg, rgba(13,10,32,0.45) 0%, rgba(4,4,10,0.2) 45%, rgba(4,4,10,0.7) 100%), radial-gradient(ellipse at 20% 45%, rgba(124,58,237,0.35) 0%, transparent 55%)',
        }}
      />
    </>
  );
}

const reduceMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Soft glow that follows the cursor across the hero. */
function CursorGlow(): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion()) return;
    let raf = 0;
    let x = window.innerWidth * 0.3;
    let y = window.innerHeight * 0.5;
    let tx = x;
    let ty = y;
    const onMove = (e: MouseEvent): void => {
      tx = e.clientX;
      ty = e.clientY;
    };
    const tick = (): void => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      el.style.transform = `translate3d(${x - 300}px, ${y - 300}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 h-[600px] w-[600px] rounded-full"
      style={{
        zIndex: 0,
        background: 'radial-gradient(circle, rgba(167,139,250,0.16) 0%, rgba(124,58,237,0.06) 35%, transparent 65%)',
        mixBlendMode: 'screen',
      }}
    />
  );
}

const PIPELINE = ['Discover', 'Generate', 'Execute', 'Investigate', 'Cluster'];

/** Five-stage pipeline that lights up in sequence, with a travelling pulse. */
function PipelineStrip({ show }: { show: boolean }): JSX.Element {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!show) return;
    const t = setInterval(() => setActive((a) => (a + 1) % PIPELINE.length), 1400);
    return () => clearInterval(t);
  }, [show]);
  return (
    <div
      className="mt-10 flex flex-wrap items-center gap-2 transition-all duration-700"
      style={{ opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(8px)' }}
    >
      {PIPELINE.map((step, i) => {
        const on = i === active;
        const past = i < active;
        return (
          <div key={step} className="flex items-center gap-2">
            <span
              className="relative rounded-full border px-3 py-1 text-[12px] tracking-wide backdrop-blur-md transition-all duration-500"
              style={{
                borderColor: on ? 'rgba(196,181,253,0.8)' : 'rgba(255,255,255,0.14)',
                background: on ? 'rgba(124,58,237,0.35)' : past ? 'rgba(124,58,237,0.12)' : 'rgba(10,8,24,0.35)',
                color: on ? '#fff' : 'rgba(255,255,255,0.65)',
                boxShadow: on ? '0 0 24px -4px rgba(167,139,250,0.8)' : 'none',
                transitionDelay: `${i * 40}ms`,
              }}
            >
              {step}
            </span>
            {i < PIPELINE.length - 1 && (
              <span className="relative hidden h-px w-6 overflow-hidden bg-white/15 sm:block">
                {on && <span className="lp-travel absolute top-0 h-px w-3 bg-[#c4b5fd]" />}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ShinyCta({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): JSX.Element {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  // Magnetic pull towards the cursor while hovering.
  const onMove = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const el = ref.current;
    if (!el || reduceMotion()) return;
    const r = el.getBoundingClientRect();
    const mx = e.clientX - (r.left + r.width / 2);
    const my = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${mx * 0.18}px, ${my * 0.28}px)`;
  };
  const onLeave = (): void => {
    if (ref.current) ref.current.style.transform = '';
  };
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const r = e.currentTarget.getBoundingClientRect();
    const id = Date.now();
    setRipples((rs) => [...rs, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
    setTimeout(() => setRipples((rs) => rs.filter((x) => x.id !== id)), 650);
    setTimeout(onClick, 180);
  };

  return (
    <button
      ref={ref}
      onClick={handleClick}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="group relative mt-2 inline-flex items-center gap-3 overflow-hidden rounded-full px-8 py-4 text-[15px] font-medium text-white transition-transform duration-300 ease-out sm:px-10 sm:text-[16px]"
      style={{
        background:
          'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 45%, #7c3aed 100%)',
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.18) inset, 0 10px 30px -8px rgba(124,58,237,0.55), 0 0 60px -12px rgba(167,139,250,0.55)',
      }}
    >
      {/* Breathing halo */}
      <span
        aria-hidden="true"
        className="lp-halo pointer-events-none absolute -inset-1 rounded-full"
        style={{ boxShadow: '0 0 0 0 rgba(167,139,250,0.55)' }}
      />
      {/* Sheen sweep */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-[900ms] ease-out group-hover:translate-x-full"
      />
      {/* Inner top-light bevel */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 top-0 h-1/2 rounded-t-full opacity-70"
        style={{
          background:
            'linear-gradient(to bottom, rgba(255,255,255,0.35), transparent)',
        }}
      />
      {/* Outer ambient ring */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px rounded-full opacity-70 blur-[1px]"
        style={{
          background:
            'linear-gradient(135deg, rgba(196,181,253,0.55), rgba(124,58,237,0) 45%, rgba(167,139,250,0.45))',
        }}
      />
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden="true"
          className="lp-ripple pointer-events-none absolute rounded-full bg-white/40"
          style={{ left: r.x, top: r.y }}
        />
      ))}

      <span className="relative tracking-wide">{label}</span>
      <svg
        className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14M13 5l7 7-7 7" />
      </svg>
    </button>
  );
}

/** Wordmark that resolves letter by letter out of a blur. */
function Wordmark({ visible }: { visible: boolean }): JSX.Element {
  const text = 'AI Bug Hunter';
  return (
    <h1
      className="mb-6 flex items-center gap-4 text-[42px] leading-none tracking-tight text-white sm:text-[56px] md:text-[68px]"
      style={{
        fontFamily: 'var(--font-heading)',
        textShadow: '0 4px 30px rgba(124,58,237,0.35)',
      }}
      aria-label="AI Bug Hunter"
    >
      <span aria-hidden="true">
        {text.split('').map((ch, i) => (
          <span
            key={i}
            className="inline-block"
            style={{
              opacity: visible ? 1 : 0,
              filter: visible ? 'blur(0px)' : 'blur(12px)',
              transform: visible ? 'translateY(0)' : 'translateY(18px)',
              transition: 'opacity 0.7s ease, filter 0.7s ease, transform 0.7s cubic-bezier(0.16,1,0.3,1)',
              transitionDelay: `${i * 45}ms`,
              whiteSpace: 'pre',
            }}
          >
            {ch}
          </span>
        ))}
        <sup className="text-[0.35em] font-normal">®</sup>
      </span>
      <span
        aria-hidden="true"
        className="lp-star select-none text-[0.7em] text-[#c4b5fd] transition-colors hover:text-white"
        style={{ letterSpacing: '-0.02em' }}
      >
        ✳︎
      </span>
    </h1>
  );
}

function TopNav({ visible }: { visible: boolean }): JSX.Element {
  return (
    <nav
      className="fixed inset-x-0 top-0 z-20 flex items-center px-6 py-5 transition-all duration-700 sm:px-10 md:px-16"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-10px)' }}
    >
      <div className="flex items-center gap-2.5 text-sm text-white/85">
        <svg width={22} height={22} viewBox="0 0 100 100" aria-hidden="true" className="lp-spin">
          <polygon points="50,4 87,25 87,75 50,96 13,75 13,25" fill="rgba(167,139,250,0.18)" stroke="#a78bfa" strokeWidth={5} />
          <circle cx={50} cy={50} r={10} fill="#c4b5fd" />
        </svg>
        <span className="tracking-[0.18em] uppercase text-[11px]">Autonomous QA</span>
      </div>
    </nav>
  );
}

function Hero({
  isAuthenticated,
  onCta,
}: {
  isAuthenticated: boolean;
  onCta: () => void;
}): JSX.Element {
  const { displayed, done } = useTypewriter(
    "Point me at your app. I'll find the bugs before your users do.",
  );
  const [visible, setVisible] = useState(false);
  const ctaLabel = isAuthenticated ? CTA_LABEL_AUTH : CTA_LABEL_GUEST;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(t);
  }, []);

  // Enter continues, so keyboard users never need to hunt for the button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) onCta();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCta]);

  return (
    <>
      <TopNav visible={visible} />
      <section className="relative z-[1] flex h-screen items-center overflow-hidden px-6 sm:px-10 md:px-16">
        <div className="relative z-10 max-w-2xl">
          <Wordmark visible={visible} />

          {/* Tagline (typewriter) */}
          <p
            className="mb-10 max-w-xl text-white/95"
            style={{
              fontSize: 'clamp(18px, 2.4vw, 26px)',
              lineHeight: 1.35,
              fontWeight: 400,
              minHeight: 54,
            }}
          >
            {displayed}
            {!done && (
              <span
                aria-hidden="true"
                className="mf-cursor-blink ml-[2px] inline-block h-[1.1em] w-[2px] bg-white align-middle"
              />
            )}
          </p>

          {/* Single premium CTA */}
          <div
            className="flex flex-wrap items-center gap-5 transition-all duration-700"
            style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)', transitionDelay: '500ms' }}
          >
            <ShinyCta label={ctaLabel} onClick={onCta} />
            <span className="mt-2 hidden items-center gap-2 text-[12px] text-white/50 sm:flex">
              or press
              <kbd className="rounded-md border border-white/20 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-white/75">
                Enter ↵
              </kbd>
            </span>
          </div>

          <PipelineStrip show={done} />
        </div>
      </section>
    </>
  );
}

export function LandingPage({ isAuthenticated, onCta }: Props): JSX.Element {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#04040a] text-white">
      <BackgroundVideo />
      <CursorGlow />
      <Hero isAuthenticated={isAuthenticated} onCta={onCta} />
      {/* Bottom vignette rule */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 h-px"
        style={{ zIndex: 2, background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.6), rgba(34,211,238,0.4), transparent)' }}
      />
      <style>{`
        .lp-star { display: inline-block; animation: lpSpin 12s linear infinite; }
        .lp-star:hover { animation-duration: 1.2s; }
        .lp-spin { animation: lpSpin 20s linear infinite; }
        @keyframes lpSpin { to { transform: rotate(360deg); } }
        .lp-travel { animation: lpTravel 1.4s linear infinite; }
        @keyframes lpTravel { from { left: -30%; } to { left: 100%; } }
        .lp-halo { animation: lpHalo 2.8s ease-out infinite; }
        @keyframes lpHalo { 0% { box-shadow: 0 0 0 0 rgba(167,139,250,0.5); } 80%, 100% { box-shadow: 0 0 0 14px rgba(167,139,250,0); } }
        .lp-ripple { width: 12px; height: 12px; margin: -6px 0 0 -6px; animation: lpRipple 0.65s ease-out forwards; }
        @keyframes lpRipple { to { transform: scale(26); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .lp-star, .lp-spin, .lp-halo, .lp-travel { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
