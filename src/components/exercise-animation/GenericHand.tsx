'use client';

/**
 * Fallback hand silhouette used when an `exerciseCode` doesn't have a
 * dedicated animation yet. Static (no motion) so it's safe everywhere,
 * including older browsers or `prefers-reduced-motion`.
 */
export function GenericHand({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 240"
      role="img"
      aria-label="Mano"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="#007AFF"
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M 70 140 Q 60 175 90 200 L 170 200 Q 188 180 178 140 Q 178 130 168 128 Q 158 130 158 140 L 158 122 Q 158 110 148 110 Q 138 110 138 122 L 138 116 Q 138 104 128 104 Q 118 104 118 116 L 118 122 Q 118 110 108 110 Q 98 110 98 122 L 98 130 Q 88 130 86 140 Q 80 140 70 140 Z"
        fill="#007AFF"
        fillOpacity={0.06}
        stroke="none"
      />
      <path d="M 50 100 L 70 140" />
      <path d="M 90 50 L 92 120" />
      <path d="M 116 40 L 116 116" />
      <path d="M 142 50 L 140 120" />
      <path d="M 168 70 L 162 128" />
      <path d="M 80 200 L 175 200" />
    </svg>
  );
}
