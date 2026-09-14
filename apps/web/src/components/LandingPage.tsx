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

function ShinyCta({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="group relative mt-2 inline-flex items-center gap-3 overflow-hidden rounded-full px-8 py-4 text-[15px] font-medium text-white transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0 sm:px-10 sm:text-[16px]"
      style={{
        background:
          'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 45%, #7c3aed 100%)',
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.18) inset, 0 10px 30px -8px rgba(124,58,237,0.55), 0 0 60px -12px rgba(167,139,250,0.55)',
      }}
    >
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

  return (
    <section className="relative z-[1] flex h-screen items-center overflow-hidden px-6 sm:px-10 md:px-16">
      <div
        className="relative z-10 max-w-2xl"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        {/* Wordmark */}
        <h1
          className="mb-6 flex items-center gap-4 text-[42px] leading-none tracking-tight text-white sm:text-[56px] md:text-[68px]"
          style={{
            fontFamily: 'var(--font-heading)',
            textShadow: '0 4px 30px rgba(124,58,237,0.35)',
          }}
        >
          <span>
            AI Bug Hunter<sup className="text-[0.35em] font-normal">®</sup>
          </span>
          <span
            aria-hidden="true"
            className="select-none text-[0.7em] text-[#c4b5fd]"
            style={{ letterSpacing: '-0.02em' }}
          >
            ✳︎
          </span>
        </h1>

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
        <ShinyCta label={ctaLabel} onClick={onCta} />
      </div>
    </section>
  );
}

export function LandingPage({ isAuthenticated, onCta }: Props): JSX.Element {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#04040a] text-white">
      <BackgroundVideo />
      <Hero isAuthenticated={isAuthenticated} onCta={onCta} />
    </div>
  );
}
