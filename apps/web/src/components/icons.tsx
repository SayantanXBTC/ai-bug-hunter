import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, className, ...rest }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
    className,
    ...rest,
  };
}

export function IconCheck(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconX(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconAlertTriangle(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function IconSparkles(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}

export function IconRefresh(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function IconActivity(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

export function IconBug(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <rect x="8" y="6" width="8" height="14" rx="4" />
      <path d="M12 6V4M9 4h6M4 12h4M16 12h4M5 20l3-2M19 20l-3-2M5 8l3 2M19 8l-3 2" />
    </svg>
  );
}

export function IconPaperclip(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l8.57-8.57a4 4 0 1 1 5.66 5.66L9.41 17.41a2 2 0 1 1-2.83-2.83l8.49-8.49" />
    </svg>
  );
}

export function IconPlus(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconGlobe(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export function IconSpinner(props: IconProps): JSX.Element {
  const { className, ...rest } = props;
  return (
    <svg {...base({ ...rest, className: `${className ?? ''} animate-spin`.trim() })}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export function IconXMark(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconExternalLink(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function IconLayers(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

export function IconFileText(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export function IconList(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

export function IconCodeBrackets(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

export function IconArrowLeft(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function IconPlay(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

export function IconPencil(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

export function IconTrash(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function IconEye(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconEyeOff(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.77 19.77 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.87 19.87 0 0 1-3.17 4.19" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function IconMail(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="22 6 12 13 2 6" />
    </svg>
  );
}

export function IconLock(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function IconHexLogo(props: IconProps): JSX.Element {
  const { size = 24, ...rest } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <polygon points="20,3 34,11 34,29 20,37 6,29 6,11" />
      <circle cx="20" cy="20" r="2.6" fill="currentColor" />
      <line x1="20" y1="20" x2="12" y2="14" opacity="0.7" />
      <line x1="20" y1="20" x2="28" y2="14" opacity="0.7" />
      <line x1="20" y1="20" x2="20" y2="30" opacity="0.7" />
      <circle cx="12" cy="14" r="1.4" fill="currentColor" opacity="0.85" />
      <circle cx="28" cy="14" r="1.4" fill="currentColor" opacity="0.85" />
      <circle cx="20" cy="30" r="1.4" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export function IconBrain(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M9 3a3 3 0 0 0-3 3v0a3 3 0 0 0-3 3v2a3 3 0 0 0 2 2.83V16a3 3 0 0 0 3 3h1v2h4V5a2 2 0 0 0-2-2H9z" />
      <path d="M15 3a2 2 0 0 1 2 2v16h-2" />
      <path d="M17 6a3 3 0 0 1 3 3v0a3 3 0 0 1 1 5.66V16a3 3 0 0 1-3 3h-1" />
    </svg>
  );
}

export function IconShield(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

export function IconNetwork(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="2" />
      <circle cx="5" cy="5" r="2" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <line x1="7" y1="7" x2="10.5" y2="10.5" />
      <line x1="17" y1="7" x2="13.5" y2="10.5" />
      <line x1="7" y1="17" x2="10.5" y2="13.5" />
      <line x1="17" y1="17" x2="13.5" y2="13.5" />
    </svg>
  );
}

export function IconTarget(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

export function IconRadar(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="10" opacity="0.4" />
      <circle cx="12" cy="12" r="6" opacity="0.6" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <line x1="12" y1="12" x2="20" y2="6" />
    </svg>
  );
}
