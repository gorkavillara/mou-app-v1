type Props = {
  pct: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
};

function clamp(n: number) {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function colorFor(pct: number) {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

export function AdherenceBar({ pct, showLabel = true, size = 'md' }: Props) {
  const value = clamp(pct);
  const trackHeight = size === 'sm' ? 'h-1.5' : 'h-2';

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className={`flex-1 ${trackHeight} bg-gray-100 rounded-full overflow-hidden`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full ${colorFor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-gray-600 tabular-nums w-9 text-right">
          {value}%
        </span>
      )}
    </div>
  );
}
