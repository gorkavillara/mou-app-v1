'use client';

/**
 * Realistic, lightly-shaded anatomical hand that actively closes into a fist
 * and opens again (open → fist → open), looping ~3s. Used as the fallback
 * animation and, in particular, for "flexión activa de dedos".
 *
 * Design / technique:
 *  - The hand is drawn as a filled palm (radial gradient for volume) plus five
 *    fingers, each built from rounded "phalange" capsules so the silhouette
 *    reads as a real hand rather than stick-figure lines.
 *  - Animation is pure CSS keyframes inside the SVG (`<style>`). Each finger is
 *    a `<g>` that rotates around its MCP knuckle using `transform-box: view-box`
 *    + an absolute `transform-origin`, so the fold pivots from the right point.
 *    No JS, no SMIL — 60fps-friendly and offscreen-throttled by the browser.
 *  - A small per-finger stagger (animation-delay) makes the close feel organic.
 *  - `prefers-reduced-motion: reduce` pins every finger flat (no motion).
 *  - All gradient / id names are prefixed `gh-` so two animations can mount at
 *    once without colliding.
 */

export function GenericHand({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 240"
      role="img"
      aria-label="Animación: la mano se cierra en puño y se vuelve a abrir"
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{`
        .gh-finger { transform-box: view-box; transform: rotate(0deg); }
        .gh-f-index  { transform-origin: 88px 132px;  animation: gh-close 3s cubic-bezier(.45,0,.25,1) infinite; }
        .gh-f-middle { transform-origin: 116px 130px; animation: gh-close 3s cubic-bezier(.45,0,.25,1) infinite; animation-delay: .06s; }
        .gh-f-ring   { transform-origin: 142px 132px; animation: gh-close 3s cubic-bezier(.45,0,.25,1) infinite; animation-delay: .12s; }
        .gh-f-pinky  { transform-origin: 166px 138px; animation: gh-close 3s cubic-bezier(.45,0,.25,1) infinite; animation-delay: .18s; }
        .gh-f-thumb  { transform-origin: 78px 150px;  animation: gh-thumb 3s cubic-bezier(.45,0,.25,1) infinite; }

        @keyframes gh-close {
          0%, 12%   { transform: rotate(0deg); }
          48%, 62%  { transform: rotate(78deg); }
          92%, 100% { transform: rotate(0deg); }
        }
        @keyframes gh-thumb {
          0%, 12%   { transform: rotate(0deg); }
          48%, 62%  { transform: rotate(34deg); }
          92%, 100% { transform: rotate(0deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gh-finger { animation: none !important; transform: rotate(0deg) !important; }
        }
      `}</style>

      <defs>
        <radialGradient id="gh-skin" cx="42%" cy="34%" r="78%">
          <stop offset="0%" stopColor="#FBE7DA" />
          <stop offset="55%" stopColor="#F2CDB6" />
          <stop offset="100%" stopColor="#E0AE92" />
        </radialGradient>
        <linearGradient id="gh-finger-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBE3D4" />
          <stop offset="100%" stopColor="#EBBC9F" />
        </linearGradient>
      </defs>

      <g fill="url(#gh-skin)" stroke="#C98E6F" strokeWidth={2.5} strokeLinejoin="round">
        {/* Palm */}
        <path d="M 70 138 Q 62 170 76 192 Q 92 214 124 212 Q 162 210 174 186 Q 182 168 178 142 Q 176 128 168 128 Q 160 128 158 140 L 158 150 Q 120 156 84 150 Q 76 140 70 138 Z" />

        {/* Thumb (opposed, lower-left) */}
        <g className="gh-finger gh-f-thumb">
          <path
            d="M 80 150 Q 64 132 54 112 Q 50 102 58 98 Q 66 95 72 104 Q 84 124 92 142 Z"
            fill="url(#gh-finger-grad)"
          />
        </g>

        {/* Index */}
        <g className="gh-finger gh-f-index">
          <rect x="79" y="58" width="20" height="78" rx="10" fill="url(#gh-finger-grad)" />
          <line x1="80" y1="92" x2="98" y2="92" stroke="#D7A488" strokeWidth={1.5} />
        </g>
        {/* Middle */}
        <g className="gh-finger gh-f-middle">
          <rect x="107" y="48" width="20" height="86" rx="10" fill="url(#gh-finger-grad)" />
          <line x1="108" y1="86" x2="126" y2="86" stroke="#D7A488" strokeWidth={1.5} />
        </g>
        {/* Ring */}
        <g className="gh-finger gh-f-ring">
          <rect x="133" y="56" width="20" height="80" rx="10" fill="url(#gh-finger-grad)" />
          <line x1="134" y1="92" x2="152" y2="92" stroke="#D7A488" strokeWidth={1.5} />
        </g>
        {/* Pinky */}
        <g className="gh-finger gh-f-pinky">
          <rect x="158" y="76" width="18" height="66" rx="9" fill="url(#gh-finger-grad)" />
          <line x1="159" y1="106" x2="175" y2="106" stroke="#D7A488" strokeWidth={1.5} />
        </g>
      </g>

      {/* Wrist band — brand accent */}
      <rect x="84" y="206" width="72" height="14" rx="7" fill="#007AFF" fillOpacity={0.9} />
    </svg>
  );
}
