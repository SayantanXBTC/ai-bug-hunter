/**
 * Ambient page backdrop: a soft theme-aware gradient with one slow-moving
 * light. Kept deliberately quiet so content stays the focus.
 */
export function PageAmbient(): JSX.Element {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'var(--ambient-bg)' }} />
      <div
        className="absolute -top-1/3 left-1/3 h-[70vh] w-[70vh] rounded-full blur-3xl motion-reduce:hidden"
        style={{
          background: 'radial-gradient(circle, var(--primary-soft), transparent 70%)',
          animation: 'paDrift 40s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes paDrift { 0%,100% { transform: translate3d(0,0,0);} 50% { transform: translate3d(-8vw,6vh,0);} }
      `}</style>
    </div>
  );
}
