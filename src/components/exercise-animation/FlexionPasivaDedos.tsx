'use client';

/**
 * IA-07 / F-12 — Animated guide for "Flexión pasiva de dedos".
 *
 * Stylised SVG of a hand whose fingers bend toward the palm (flexion) and
 * extend back, looping every 3s. We avoid drawing the contralateral helping
 * hand on purpose — the second hand muddies the silhouette and the helper
 * action is conveyed by the description text on the prescription card.
 *
 * Implementation notes:
 *  - We use SMIL (`<animateTransform>`) for the finger bends because it
 *    composes cleanly per finger, runs without React state, and auto-pauses
 *    when the SVG is offscreen on most engines. SMIL is supported on every
 *    browser we target (Safari iOS 12+, Chromium, Firefox).
 *  - Each finger pivots around its MCP knuckle. A single sine-eased rotation
 *    is enough to read as "opening / closing" without animating PIP/DIP
 *    individually — the designer can replace this whole component with a
 *    Lottie file later.
 *  - `prefers-reduced-motion` is respected via a CSS media query that pins
 *    each animated transform at 0deg.
 */

const HOLD_DUR = '3s';

type FingerSpec = {
  /** Knuckle pivot in SVG coords. */
  cx: number;
  cy: number;
  /** End angle for full flexion. */
  flex: number;
  /** Phase offset — small stagger feels more natural than perfectly synced fingers. */
  begin: string;
  /** Path of the finger in extended position (pivot at cx,cy). */
  path: string;
};

// Coordinates are tuned for a 240x240 viewBox with the wrist near the bottom
// and fingertips near the top. Stylised, not anatomically perfect.
const FINGERS: FingerSpec[] = [
  // index
  {
    cx: 92, cy: 120, flex: 75, begin: '0s',
    path: 'M 92 120 L 90 50',
  },
  // middle
  {
    cx: 116, cy: 116, flex: 80, begin: '0.05s',
    path: 'M 116 116 L 116 40',
  },
  // ring
  {
    cx: 140, cy: 120, flex: 75, begin: '0.1s',
    path: 'M 140 120 L 142 50',
  },
  // pinky
  {
    cx: 162, cy: 128, flex: 70, begin: '0.15s',
    path: 'M 162 128 L 168 70',
  },
];

// Thumb behaves differently — it abducts/flexes around its own pivot.
const THUMB = {
  cx: 70, cy: 140,
  flex: -40,
  path: 'M 70 140 L 50 100',
};

export function FlexionPasivaDedos({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 240"
      role="img"
      aria-label="Animación: flexión pasiva de dedos"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="#007AFF"
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .mou-anim animateTransform { display: none; }
          .mou-finger { transform: none !important; }
        }
      `}</style>
      {/* Palm */}
      <path
        d="M 70 140 Q 60 175 90 200 L 170 200 Q 188 180 178 140 Q 178 130 168 128 Q 158 130 158 140 L 158 122 Q 158 110 148 110 Q 138 110 138 122 L 138 116 Q 138 104 128 104 Q 118 104 118 116 L 118 122 Q 118 110 108 110 Q 98 110 98 122 L 98 130 Q 88 130 86 140 Q 80 140 70 140 Z"
        fill="#007AFF"
        fillOpacity={0.06}
        stroke="none"
      />
      {/* Wrist line */}
      <path d="M 80 200 L 175 200" />

      <g className="mou-anim">
        {/* Thumb */}
        <g className="mou-finger">
          <path d={THUMB.path} />
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${THUMB.cx} ${THUMB.cy}`}
            to={`0 ${THUMB.cx} ${THUMB.cy}`}
            values={`0 ${THUMB.cx} ${THUMB.cy};${THUMB.flex} ${THUMB.cx} ${THUMB.cy};0 ${THUMB.cx} ${THUMB.cy}`}
            keyTimes="0;0.5;1"
            dur={HOLD_DUR}
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
          />
        </g>

        {/* Long fingers */}
        {FINGERS.map((f, i) => (
          <g key={i} className="mou-finger">
            <path d={f.path} />
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`0 ${f.cx} ${f.cy}`}
              to={`0 ${f.cx} ${f.cy}`}
              values={`0 ${f.cx} ${f.cy};${f.flex} ${f.cx} ${f.cy};0 ${f.cx} ${f.cy}`}
              keyTimes="0;0.5;1"
              dur={HOLD_DUR}
              begin={f.begin}
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
