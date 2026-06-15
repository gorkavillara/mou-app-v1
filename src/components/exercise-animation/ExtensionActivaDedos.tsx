'use client';

/**
 * IA-07 / F-12 — Animated guide for "Extensión activa de dedos".
 *
 * Realistic, lightly-shaded anatomical hand whose fingers start curled and
 * actively straighten out to full extension before curling back, looping ~3s.
 * Mirror of the flexion guide: the resting/loop poses are flexed and the
 * motion eases OUT to open — a brisker, "active" feel than the passive variant.
 *
 * Technique (same family as `GenericHand` / `FlexionPasivaDedos`):
 *  - Filled palm with radial gradient + rounded "phalange" capsules per finger.
 *  - Pure CSS keyframes inside the SVG. Each finger is a `<g>` rotated around
 *    its MCP knuckle via `transform-box: view-box` + absolute `transform-origin`.
 *  - The base transform is the flexed pose; keyframes extend to 0deg and back.
 *  - Small per-finger stagger; `prefers-reduced-motion` pins fingers open (flat).
 *  - All ids prefixed `ea-` so this can mount alongside other animations.
 */

export function ExtensionActivaDedos({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 240"
      role="img"
      aria-label="Animación: extensión activa de dedos, abriendo la mano por completo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{`
        .ea-finger { transform-box: view-box; }
        .ea-f-index  { transform-origin: 88px 132px;  transform: rotate(70deg); animation: ea-ext-long 3s cubic-bezier(.5,0,.2,1) infinite; }
        .ea-f-middle { transform-origin: 116px 130px; transform: rotate(70deg); animation: ea-ext-long 3s cubic-bezier(.5,0,.2,1) infinite; animation-delay: .06s; }
        .ea-f-ring   { transform-origin: 142px 132px; transform: rotate(70deg); animation: ea-ext-long 3s cubic-bezier(.5,0,.2,1) infinite; animation-delay: .12s; }
        .ea-f-pinky  { transform-origin: 166px 138px; transform: rotate(70deg); animation: ea-ext-long 3s cubic-bezier(.5,0,.2,1) infinite; animation-delay: .18s; }
        .ea-f-thumb  { transform-origin: 78px 150px;  transform: rotate(24deg); animation: ea-ext-thumb 3s cubic-bezier(.5,0,.2,1) infinite; }

        @keyframes ea-ext-long {
          0%, 12%   { transform: rotate(70deg); }
          46%, 64%  { transform: rotate(0deg); }
          92%, 100% { transform: rotate(70deg); }
        }
        @keyframes ea-ext-thumb {
          0%, 12%   { transform: rotate(24deg); }
          46%, 64%  { transform: rotate(0deg); }
          92%, 100% { transform: rotate(24deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ea-finger { animation: none !important; transform: rotate(0deg) !important; }
        }
      `}</style>

      <defs>
        <radialGradient id="ea-skin" cx="42%" cy="34%" r="78%">
          <stop offset="0%" stopColor="#FBE7DA" />
          <stop offset="55%" stopColor="#F2CDB6" />
          <stop offset="100%" stopColor="#E0AE92" />
        </radialGradient>
        <linearGradient id="ea-finger-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBE3D4" />
          <stop offset="100%" stopColor="#EBBC9F" />
        </linearGradient>
      </defs>

      <g fill="url(#ea-skin)" stroke="#C98E6F" strokeWidth={2.5} strokeLinejoin="round">
        <path d="M 70 138 Q 62 170 76 192 Q 92 214 124 212 Q 162 210 174 186 Q 182 168 178 142 Q 176 128 168 128 Q 160 128 158 140 L 158 150 Q 120 156 84 150 Q 76 140 70 138 Z" />

        <g className="ea-finger ea-f-thumb">
          <path
            d="M 80 150 Q 64 132 54 112 Q 50 102 58 98 Q 66 95 72 104 Q 84 124 92 142 Z"
            fill="url(#ea-finger-grad)"
          />
        </g>

        <g className="ea-finger ea-f-index">
          <rect x="79" y="58" width="20" height="78" rx="10" fill="url(#ea-finger-grad)" />
          <line x1="80" y1="92" x2="98" y2="92" stroke="#D7A488" strokeWidth={1.5} />
        </g>
        <g className="ea-finger ea-f-middle">
          <rect x="107" y="48" width="20" height="86" rx="10" fill="url(#ea-finger-grad)" />
          <line x1="108" y1="86" x2="126" y2="86" stroke="#D7A488" strokeWidth={1.5} />
        </g>
        <g className="ea-finger ea-f-ring">
          <rect x="133" y="56" width="20" height="80" rx="10" fill="url(#ea-finger-grad)" />
          <line x1="134" y1="92" x2="152" y2="92" stroke="#D7A488" strokeWidth={1.5} />
        </g>
        <g className="ea-finger ea-f-pinky">
          <rect x="158" y="76" width="18" height="66" rx="9" fill="url(#ea-finger-grad)" />
          <line x1="159" y1="106" x2="175" y2="106" stroke="#D7A488" strokeWidth={1.5} />
        </g>
      </g>

      <rect x="84" y="206" width="72" height="14" rx="7" fill="#007AFF" fillOpacity={0.9} />
    </svg>
  );
}
