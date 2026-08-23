import { useRef, useState, type FormEvent, type ReactNode, type MouseEvent } from 'react';
import {
  IconEye,
  IconEyeOff,
  IconSpinner,
  IconMail,
  IconLock,
  IconArrowRight,
  IconHexLogo,
} from '../icons.js';

interface LoginCardProps {
  mode: 'login' | 'register';
  email: string;
  password: string;
  error: string | null;
  submitting: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: (ev: FormEvent) => void;
  onSwitchMode: () => void;
}

/**
 * Premium login card — inspired by ruixen sign-in-card-2.
 *
 * Adds: 3D mouse tilt, traveling light beams around the border,
 * corner glow spots, breathing card glow, animated shimmer on the
 * primary button. Pure CSS keyframes + React mouseMove — no
 * framer-motion. Auth logic is byte-identical to prior version.
 */
export function LoginCard(props: LoginCardProps): JSX.Element {
  const {
    mode,
    email,
    password,
    error,
    submitting,
    onEmailChange,
    onPasswordChange,
    onSubmit,
    onSwitchMode,
  } = props;
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const errorId = 'login-error';
  const emailId = 'login-email';
  const passwordId = 'login-password';

  const primaryLabel = mode === 'login' ? 'Sign in' : 'Create account';
  const loadingLabel = mode === 'login' ? 'Signing in…' : 'Creating account…';

  const inputBase =
    'w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pl-11 pr-4 py-2.5 text-[16px] md:text-sm text-white placeholder:text-white/25 outline-none transition-all duration-300 focus:border-white/25 focus:bg-white/[0.06]';

  function handleMouseMove(e: MouseEvent<HTMLDivElement>): void {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    // clamp to reasonable tilt range
    const rotX = Math.max(-8, Math.min(8, (-y / rect.height) * 16));
    const rotY = Math.max(-8, Math.min(8, (x / rect.width) * 16));
    setTilt({ x: rotX, y: rotY });
  }
  function handleMouseLeave(): void {
    setTilt({ x: 0, y: 0 });
  }

  const label = (htmlFor: string, children: ReactNode): JSX.Element => (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.22em] text-white/50"
    >
      {children}
    </label>
  );

  return (
    <div className="relative mx-auto w-full" style={{ perspective: 1500 }}>
      <style>{`
        @keyframes beam-h {
          0%   { transform: translateX(-100%); opacity: 0; }
          15%  { opacity: 0.8; }
          85%  { opacity: 0.8; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        @keyframes beam-v {
          0%   { transform: translateY(-100%); opacity: 0; }
          15%  { opacity: 0.8; }
          85%  { opacity: 0.8; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        @keyframes corner-pulse {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50%      { opacity: 0.6;  transform: scale(1.2); }
        }
        @keyframes card-breathe {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 0.85; }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .beam-top {
          position: absolute; top: 0; left: 0; height: 2px; width: 40%;
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.9), transparent);
          filter: blur(1px);
          animation: beam-h 3.5s ease-in-out infinite;
        }
        .beam-right {
          position: absolute; top: 0; right: 0; width: 2px; height: 40%;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.9), transparent);
          filter: blur(1px);
          animation: beam-v 3.5s ease-in-out 0.9s infinite;
        }
        .beam-bottom {
          position: absolute; bottom: 0; right: 0; height: 2px; width: 40%;
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.9), transparent);
          filter: blur(1px);
          animation: beam-h 3.5s ease-in-out 1.75s infinite reverse;
        }
        .beam-left {
          position: absolute; bottom: 0; left: 0; width: 2px; height: 40%;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.9), transparent);
          filter: blur(1px);
          animation: beam-v 3.5s ease-in-out 2.6s infinite reverse;
        }
        .corner-glow { animation: corner-pulse 2.5s ease-in-out infinite; }
        .card-under-glow { animation: card-breathe 8s ease-in-out infinite; }
        .btn-shimmer::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.35), transparent);
          transform: translateX(-100%);
          animation: shimmer 2.5s ease-in-out infinite;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .beam-top, .beam-right, .beam-bottom, .beam-left,
          .corner-glow, .card-under-glow, .btn-shimmer::after {
            animation: none !important;
          }
        }
      `}</style>

      {/* Under-card radial glow */}
      <div
        aria-hidden="true"
        className="card-under-glow pointer-events-none absolute inset-x-4 -bottom-16 h-40 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(124,58,237,0.5), transparent 65%)',
        }}
      />

      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 200ms ease-out',
        }}
      >
        {/* Beam frame — sits on top of card border */}
        <div aria-hidden="true" className="pointer-events-none absolute -inset-px z-20 overflow-hidden rounded-3xl">
          <div className="beam-top" />
          <div className="beam-right" />
          <div className="beam-bottom" />
          <div className="beam-left" />
          {/* Corner glow dots */}
          <div
            className="corner-glow absolute -top-1 -left-1 h-2 w-2 rounded-full bg-white/70 blur-[2px]"
            style={{ animationDelay: '0s' }}
          />
          <div
            className="corner-glow absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-white/80 blur-[2px]"
            style={{ animationDelay: '0.6s' }}
          />
          <div
            className="corner-glow absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full bg-white/80 blur-[2px]"
            style={{ animationDelay: '1.2s' }}
          />
          <div
            className="corner-glow absolute -bottom-1 -left-1 h-2 w-2 rounded-full bg-white/70 blur-[2px]"
            style={{ animationDelay: '1.8s' }}
          />
        </div>

        <div
          className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-black/40 p-8 backdrop-blur-2xl md:p-10"
          style={{
            boxShadow:
              '0 40px 120px -20px rgba(124,58,237,0.5), inset 0 0 0 1px rgba(139,92,246,0.05), inset 0 1px 0 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Subtle inner grid pattern */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative flex flex-col items-center text-center">
            <div
              className="rounded-full border border-white/10 p-2 text-violet-400"
              style={{ filter: 'drop-shadow(0 0 12px rgba(167,139,250,0.7))' }}
            >
              <IconHexLogo size={40} />
            </div>
            <h1 className="mt-4 text-xl font-semibold tracking-wide text-white">
              <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                {mode === 'login' ? 'Welcome back' : 'Create an account'}
              </span>
            </h1>
            <p className="mt-1 text-xs text-white/60">
              {mode === 'login'
                ? 'Sign in to continue to AI Bug Hunter'
                : 'Register to begin autonomous QA'}
            </p>
          </div>

          <form onSubmit={onSubmit} className="relative mt-6 space-y-4" noValidate>
            <div>
              {label(emailId, 'Email')}
              <div className={`relative ${focused === 'email' ? 'z-10' : ''}`}>
                <div
                  className={`pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center transition-colors duration-300 ${
                    focused === 'email' ? 'text-white' : 'text-white/40'
                  }`}
                >
                  <IconMail size={16} />
                </div>
                <input
                  id={emailId}
                  className={inputBase}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              {label(passwordId, 'Password')}
              <div className={`relative ${focused === 'password' ? 'z-10' : ''}`}>
                <div
                  className={`pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center transition-colors duration-300 ${
                    focused === 'password' ? 'text-white' : 'text-white/40'
                  }`}
                >
                  <IconLock size={16} />
                </div>
                <input
                  id={passwordId}
                  className={`${inputBase} pr-11`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-white/40 transition hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                >
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                id={errorId}
                role="alert"
                className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting || undefined}
              className={`btn-shimmer group relative mt-5 flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-white py-2.5 text-sm font-medium text-black transition-all duration-300 hover:bg-white/90 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04040a]`}
            >
              {submitting ? (
                <>
                  <IconSpinner size={16} />
                  <span>{loadingLabel}</span>
                </>
              ) : (
                <>
                  <span>{primaryLabel}</span>
                  <IconArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative mt-2 mb-1 flex items-center">
              <div className="flex-grow border-t border-white/5" />
              <span className="mx-3 text-xs text-white/40">or</span>
              <div className="flex-grow border-t border-white/5" />
            </div>
          </form>

          <div className="relative mt-4 text-center text-xs text-white/60">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={onSwitchMode}
              className="group/switch relative inline-block font-medium text-white transition-colors hover:text-white/70 focus-visible:outline-none"
            >
              <span className="relative z-10">
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </span>
              <span className="absolute bottom-0 left-0 h-px w-0 bg-white transition-all duration-300 group-hover/switch:w-full group-focus-visible/switch:w-full" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
