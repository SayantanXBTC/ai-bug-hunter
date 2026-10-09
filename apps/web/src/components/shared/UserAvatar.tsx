import { useState } from 'react';
import type { AuthUser } from '@ai-bug-hunter/shared';

export function initialsFrom(email: string): string {
  const local = email.split('@')[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    const a = parts[0][0] ?? '';
    const b = parts[1][0] ?? '';
    return (a + b).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

/** First name from the Google display name, else from the email. */
export function firstNameOf(user: Pick<AuthUser, 'email' | 'displayName'> | null | undefined): string {
  const fromName = user?.displayName?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const local = user?.email?.split('@')[0] ?? '';
  const first = local.split(/[._\-+0-9]+/).filter(Boolean)[0] ?? local;
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : 'there';
}

interface Props {
  user: Pick<AuthUser, 'email' | 'avatarUrl' | 'displayName'>;
  /** Pixel size of the square avatar. */
  size?: number;
  className?: string;
  /** Tailwind rounding class; defaults to rounded-lg. */
  rounded?: string;
}

/**
 * Google profile photo when available, otherwise gradient initials.
 * Google photo URLs can reject requests that carry a referrer, hence
 * referrerPolicy="no-referrer"; any load error falls back to initials.
 */
export function UserAvatar({ user, size = 28, className = '', rounded = 'rounded-lg' }: Props): JSX.Element {
  const [failed, setFailed] = useState(false);
  const label = user.displayName ?? user.email;
  const box = { width: size, height: size };

  if (user.avatarUrl && !failed) {
    return (
      <img
        src={user.avatarUrl}
        alt={label}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${rounded} shrink-0 object-cover ${className}`}
        style={box}
      />
    );
  }
  return (
    <span
      aria-label={label}
      className={`${rounded} inline-flex shrink-0 items-center justify-center font-semibold uppercase tracking-wider text-white ${className}`}
      style={{ ...box, fontSize: Math.max(10, Math.round(size * 0.38)), background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}
    >
      {initialsFrom(user.email)}
    </span>
  );
}
