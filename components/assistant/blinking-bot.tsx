// Small robot face whose eyes blink every few seconds (pure SVG + CSS, no images).
export function BlinkingBot({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`aras-bot ${className}`}>
      <style>{`
        @keyframes aras-bot-blink { 0%, 88%, 100% { transform: scaleY(1); } 92% { transform: scaleY(0.1); } 96% { transform: scaleY(1); } }
        @keyframes aras-bot-antenna { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
        .aras-bot .aras-bot-eye { transform-box: fill-box; transform-origin: center; animation: aras-bot-blink 4s infinite; }
        .aras-bot .aras-bot-eye.r { animation-delay: .04s; }
        .aras-bot .aras-bot-led { animation: aras-bot-antenna 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .aras-bot .aras-bot-eye, .aras-bot .aras-bot-led { animation: none; } }
      `}</style>
      <line x1="12" y1="2.5" x2="12" y2="5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle className="aras-bot-led" cx="12" cy="2.2" r="1.3" fill="currentColor" />
      <rect x="4" y="5.5" width="16" height="13" rx="4.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="1.6" y="10" width="2" height="4.5" rx="1" fill="currentColor" />
      <rect x="20.4" y="10" width="2" height="4.5" rx="1" fill="currentColor" />
      <ellipse className="aras-bot-eye" cx="9" cy="11.5" rx="1.6" ry="1.9" fill="currentColor" />
      <ellipse className="aras-bot-eye r" cx="15" cy="11.5" rx="1.6" ry="1.9" fill="currentColor" />
      <path d="M9.2 15.2c1.6 1.1 4 1.1 5.6 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
