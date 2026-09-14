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

function CopyIcon(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="1.5" y="3.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
      <rect x="4.5" y="1.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function Navbar({
  isAuthenticated,
  onCta,
}: {
  isAuthenticated: boolean;
  onCta: () => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const links = ['Overview', 'How it works', 'Docs', 'Changelog'];
  const ctaLabel = isAuthenticated ? CTA_LABEL_AUTH : CTA_LABEL_GUEST;

  return (
    <>
      <nav className="fixed left-0 right-0 top-0 z-10 flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span
            className="text-[21px] tracking-tight text-white sm:text-[26px]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            AI Bug Hunter<sup>®</sup>
          </span>
          <span
            aria-hidden="true"
            className="select-none text-[25px] text-[#c4b5fd] sm:text-[30px]"
            style={{ letterSpacing: '-0.02em' }}
          >
            ✳︎
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden items-center gap-0 text-[23px] text-white md:flex">
          {links.map((l, i) => (
            <span key={l} className="flex items-center">
              <a href="#" className="transition-opacity hover:opacity-60">
                {l}
              </a>
              {i < links.length - 1 && <span className="mx-1">,&nbsp;</span>}
            </span>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-6 md:flex">
          <button
            onClick={onCta}
            className="rounded-full border border-white/30 bg-[#8B5CF6] px-5 py-2 text-[16px] text-white shadow-[0_0_24px_rgba(139,92,246,0.35)] transition-all hover:bg-[#7c3aed] hover:shadow-[0_0_32px_rgba(139,92,246,0.55)]"
          >
            {ctaLabel}
          </button>
          <a
            href="mailto:hello@aibughunter.dev"
            className="text-[23px] text-white underline underline-offset-2 transition-opacity hover:opacity-60"
          >
            Contact
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          aria-label="Toggle menu"
          className="flex flex-col items-center justify-center gap-[5px] md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          <span
            className="block h-[2px] w-6 bg-white transition-transform duration-300"
            style={{
              transform: open ? 'translateY(7px) rotate(45deg)' : 'none',
            }}
          />
          <span
            className="block h-[2px] w-6 bg-white transition-opacity duration-300"
            style={{ opacity: open ? 0 : 1 }}
          />
          <span
            className="block h-[2px] w-6 bg-white transition-transform duration-300"
            style={{
              transform: open ? 'translateY(-7px) rotate(-45deg)' : 'none',
            }}
          />
        </button>
      </nav>

      {/* Mobile overlay */}
      <div
        className="fixed inset-0 z-[9] flex flex-col justify-center gap-8 bg-[#04040a]/95 px-8 backdrop-blur-sm transition-opacity duration-300 md:hidden"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        {links.map((l) => (
          <a key={l} href="#" className="text-[32px] font-medium text-white">
            {l}
          </a>
        ))}
        <button
          onClick={() => {
            setOpen(false);
            onCta();
          }}
          className="w-fit rounded-full bg-[#8B5CF6] px-6 py-3 text-[24px] text-white"
        >
          {ctaLabel}
        </button>
        <a
          href="mailto:hello@aibughunter.dev"
          className="text-[32px] font-medium text-white underline underline-offset-2"
        >
          Contact
        </a>
      </div>
    </>
  );
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
      {/* Purple tint overlay to unify theme with sign-in */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          zIndex: 0,
          background:
            'linear-gradient(180deg, rgba(13,10,32,0.55) 0%, rgba(4,4,10,0.25) 45%, rgba(4,4,10,0.75) 100%), radial-gradient(ellipse at 30% 40%, rgba(124,58,237,0.28) 0%, transparent 60%)',
        }}
      />
    </>
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
  const [pillsVisible, setPillsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const ctaLabel = isAuthenticated ? CTA_LABEL_AUTH : CTA_LABEL_GUEST;

  useEffect(() => {
    const t = setTimeout(() => setPillsVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  async function copyEmail(): Promise<void> {
    try {
      await navigator.clipboard.writeText('hello@aibughunter.dev');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  const pills = [
    'How it works',
    'Watch a live run',
    'Read the docs',
    'What we test',
  ];

  return (
    <section className="relative z-[1] flex h-screen flex-col justify-end overflow-hidden px-5 pb-12 sm:px-8 md:justify-center md:px-10 md:pb-0">
      <div className="relative z-10 max-w-xl">
        {/* Blurred intro label */}
        <div
          className="pointer-events-none mb-5 select-none sm:mb-6"
          style={{
            fontSize: 'clamp(18px, 4vw, 26px)',
            lineHeight: 1.3,
            fontWeight: 400,
            color: '#ffffff',
            filter: 'blur(4px)',
          }}
        >
          Meet A.R.I.A.,
          <br />
          Autonomous Regression &amp; Investigation Agent
        </div>

        {/* Typewriter */}
        <p
          className="mb-5 text-white sm:mb-6"
          style={{
            fontSize: 'clamp(18px, 4vw, 26px)',
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

        {/* Action pills */}
        <div
          className="flex flex-wrap gap-y-1"
          style={{
            opacity: pillsVisible ? 1 : 0,
            transform: pillsVisible ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
          }}
        >
          {/* Primary CTA — auth-aware */}
          <button
            onClick={onCta}
            className="mx-[0.2em] mb-[0.4em] inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white/20 bg-[#8B5CF6] px-4 py-[0.3em] text-[13px] text-white shadow-[0_0_18px_rgba(139,92,246,0.45)] transition-colors duration-200 hover:bg-[#7c3aed] sm:px-5 sm:text-[15px]"
          >
            {ctaLabel} →
          </button>

          {pills.map((label) => (
            <button
              key={label}
              className="mx-[0.2em] mb-[0.4em] inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white/10 bg-white px-4 py-[0.3em] text-[13px] text-[#0d0a20] transition-colors duration-200 hover:bg-[#8B5CF6] hover:text-white sm:px-5 sm:text-[15px]"
            >
              {label}
            </button>
          ))}

          <button
            onClick={copyEmail}
            className="mx-[0.2em] mb-[0.4em] inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white bg-transparent px-4 py-[0.3em] text-[13px] text-white transition-colors duration-200 hover:bg-white hover:text-[#0d0a20] sm:gap-3 sm:px-5 sm:text-[15px]"
          >
            Reach us:{' '}
            <span className="underline underline-offset-1">hello@aibughunter.dev</span>
            <CopyIcon />
            {copied && <span className="ml-1 text-[11px] opacity-80">copied</span>}
          </button>
        </div>
      </div>
    </section>
  );
}

export function LandingPage({ isAuthenticated, onCta }: Props): JSX.Element {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#04040a] text-white">
      <BackgroundVideo />
      <Navbar isAuthenticated={isAuthenticated} onCta={onCta} />
      <Hero isAuthenticated={isAuthenticated} onCta={onCta} />
    </div>
  );
}
