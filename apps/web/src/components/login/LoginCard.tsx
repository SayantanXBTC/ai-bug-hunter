import { useState, type FormEvent, type ReactNode } from 'react';
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

  const errorId = 'login-error';
  const emailId = 'login-email';
  const passwordId = 'login-password';

  const primaryLabel = mode === 'login' ? 'Sign in' : 'Create account';
  const loadingLabel = mode === 'login' ? 'Signing in…' : 'Creating account…';

  const inputBase =
    'w-full rounded-xl border border-white/[0.06] bg-[rgba(0,0,0,0.4)] pl-11 pr-4 py-3 text-[16px] md:text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04040a]';

  const label = (htmlFor: string, children: ReactNode): JSX.Element => (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-500"
    >
      {children}
    </label>
  );

  return (
    <div className="relative mx-auto w-full">
      <style>{`
        @keyframes cardBreathe {
          0%, 100% { opacity: 0.75; }
          50%      { opacity: 1; }
        }
        .card-under-glow { animation: cardBreathe 10s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .card-under-glow { animation: none !important; }
        }
      `}</style>

      {/* Under-card radial glow */}
      <div
        aria-hidden="true"
        className="card-under-glow pointer-events-none absolute inset-x-8 -bottom-24 h-48 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(124,58,237,0.35), transparent 70%)',
        }}
      />

      <div
        className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-[rgba(10,8,20,0.75)] p-8 backdrop-blur-2xl md:p-12"
        style={{
          boxShadow:
            '0 40px 120px -20px rgba(124,58,237,0.5), inset 0 0 0 1px rgba(139,92,246,0.08), inset 0 1px 0 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Inner top highlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-t-3xl bg-gradient-to-b from-white/[0.04] to-transparent"
        />

        <div className="relative flex flex-col items-center text-center">
          <div
            className="text-violet-400"
            style={{ filter: 'drop-shadow(0 0 12px rgba(167,139,250,0.7))' }}
          >
            <IconHexLogo size={56} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-wide text-white">
            <span className="text-violet-400">AI</span> BUG HUNTER
          </h1>
          <div className="mx-auto my-3 h-px w-12 bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
          <p className="text-sm leading-relaxed text-neutral-400">
            Autonomous QA intelligence for modern applications
          </p>
        </div>

        <form onSubmit={onSubmit} className="relative mt-8 space-y-4" noValidate>
          <div>
            {label(emailId, 'Email')}
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-neutral-500">
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
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                placeholder="you@company.com"
              />
            </div>
          </div>

          <div>
            {label(passwordId, 'Password')}
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-neutral-500">
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
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-neutral-500 transition hover:text-neutral-200 focus-visible:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
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
            className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 py-3 text-sm font-medium text-white transition hover:from-violet-500 hover:to-violet-400 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04040a]"
            style={{ boxShadow: '0 10px 30px -10px rgba(139,92,246,0.65)' }}
          >
            {submitting ? (
              <>
                <IconSpinner size={16} />
                <span>{loadingLabel}</span>
              </>
            ) : (
              <>
                <span>{primaryLabel}</span>
                <IconArrowRight size={16} className="transition group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        <div className="relative mt-6 text-center text-xs text-neutral-500">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={onSwitchMode}
            className="font-medium text-violet-400 transition hover:text-violet-300 hover:underline focus-visible:outline-none focus-visible:underline"
          >
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
