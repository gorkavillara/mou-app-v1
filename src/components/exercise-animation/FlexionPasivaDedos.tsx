'use client';

/**
 * IA-07 / F-12 — Animated guide for "Flexión pasiva de dedos".
 *
 * Realistic, lightly-shaded anatomical hand whose fingers bend gently toward
 * the palm (assisted flexion) and hold there before easing back open, looping
 * ~3s. The "passive / assisted" feel is conveyed by a slow ease and a clear
 * hold at full flexion (vs. the snappier active variants).
 *
 * Technique (same family as `GenericHand`):
 *  - Filled palm with radial gradient for volume + rounded "phalange" capsules
 *    per finger so the silhouette reads as a real hand, not stick lines.
 *  - Pure CSS keyframes inside the SVG. Each finger is a `<g>` rotated around
 *    its MCP knuckle via `transform-box: view-box` + absolute `transform-origin`.
 *    No JS, no SMIL — 60fps-friendly.
 *  - Small per-finger stagger; `prefers-reduced-motion` pins fingers flat.
 *  - All ids prefixed `fp-` so this can mount alongside other animations.
 */

export function FlexionPasivaDedos({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 240"
      role="img"
      aria-label="Animación: flexión pasiva de dedos hacia la palma"
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{`
        .fp-finger { transform-box: view-box; transform: rotate(0deg); }
        .fp-f-index  { transform-origin: 88px 132px;  animation: fp-flex 3s cubic-bezier(.37,0,.3,1) infinite; }
        .fp-f-middle { transform-origin: 116px 130px; animation: fp-flex 3s cubic-bezier(.37,0,.3,1) infinite; animation-delay: .07s; }
        .fp-f-ring   { transform-origin: 142px 132px; animation: fp-flex 3s cubic-bezier(.37,0,.3,1) infinite; animation-delay: .14s; }
        .fp-f-pinky  { transform-origin: 166px 138px; animation: fp-flex 3s cubic-bezier(.37,0,.3,1) infinite; animation-delay: .21s; }
        .fp-f-thumb  { transform-origin: 78px 150px;  animation: fp-thumb 3s cubic-bezier(.37,0,.3,1) infinite; }

        @keyframes fp-flex {
          0%, 14%   { transform: rotate(0deg); }
          46%, 66%  { transform: rotate(72deg); }
          94%, 100% { transform: rotate(0deg); }
        }
        @keyframes fp-thumb {
          0%, 14%   { transform: rotate(0deg); }
          46%, 66%  { transform: rotate(22deg); }
          94%, 100% { transform: rotate(0deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fp-finger { animation: none !important; transform: rotate(0deg) !important; }
        }
      `}</style>

      <defs>
        <radialGradient id="fp-skin" cx="42%" cy="34%" r="78%">
          <stop offset="0%" stopColor="#FBE7DA" />
          <stop offset="55%" stopColor="#F2CDB6" />
          <stop offset="100%" stopColor="#E0AE92" />
        </radialGradient>
        <linearGradient id="fp-finger-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBE3D4" />
          <stop offset="100%" stopColor="#EBBC9F" />
        </linearGradient>
      </defs>

      <g fill="url(#fp-skin)" stroke="#C98E6F" strokeWidth={2.5} strokeLinejoin="round">
        <path d="M 70 138 Q 62 170 76 192 Q 92 214 124 212 Q 162 210 174 186 Q 182 168 178 142 Q 176 128 168 128 Q 160 128 158 140 L 158 150 Q 120 156 84 150 Q 76 140 70 138 Z" />

        <g className="fp-finger fp-f-thumb">
          <path
            d="M 80 150 Q 64 132 54 112 Q 50 102 58 98 Q 66 95 72 104 Q 84 124 92 142 Z"
            fill="url(#fp-finger-grad)"
          />
        </g>

        <g className="fp-finger fp-f-index">
          <rect x="79" y="58" width="20" height="78" rx="10" fill="url(#fp-finger-grad)" />
          <line x1="80" y1="92" x2="98" y2="92" stroke="#D7A488" strokeWidth={1.5} />
        </g>
        <g className="fp-finger fp-f-middle">
          <rect x="107" y="48" width="20" height="86" rx="10" fill="url(#fp-finger-grad)" />
          <line x1="108" y1="86" x2="126" y2="86" stroke="#D7A488" strokeWidth={1.5} />
        </g>
        <g className="fp-finger fp-f-ring">
          <rect x="133" y="56" width="20" height="80" rx="10" fill="url(#fp-finger-grad)" />
          <line x1="134" y1="92" x2="152" y2="92" stroke="#D7A488" strokeWidth={1.5} />
        </g>
        <g className="fp-finger fp-f-pinky">
          <rect x="158" y="76" width="18" height="66" rx="9" fill="url(#fp-finger-grad)" />
          <line x1="159" y1="106" x2="175" y2="106" stroke="#D7A488" strokeWidth={1.5} />
        </g>
      </g>

      <rect x="84" y="206" width="72" height="14" rx="7" fill="#007AFF" fillOpacity={0.9} />
    </svg>
  );
}
