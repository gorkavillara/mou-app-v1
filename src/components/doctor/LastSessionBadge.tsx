import { differenceInHours, formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

type Props = {
  /** Last session timestamp from the alerts endpoint, or null if never. */
  lastSessionAt: string | null | undefined;
  /**
   * Variant explicitly chosen by the page based on whether the patient is
   * "stale" (in the alerts list), "on track" (has a prescription, sessioned
   * within the threshold), or "fresh" (no prescription yet).
   */
  variant: 'stale' | 'on-track' | 'fresh';
};

const STALE_HOURS = 48;

/**
 * Small caption shown under the adherence row of every patient. Highlights
 * with a soft amber background once the gap exceeds 48h. The "on-track" and
 * "fresh" variants are visually quiet — the doctor's attention should go to
 * the highlighted ones.
 */
export function LastSessionBadge({ lastSessionAt, variant }: Props) {
  if (variant === 'fresh') {
    return (
      <span className="inline-block text-[11px] text-gray-400">
        Sin sesiones todavía
      </span>
    );
  }

  if (variant === 'on-track' && !lastSessionAt) {
    return (
      <span className="inline-block text-[11px] text-emerald-600">
        Al día
      </span>
    );
  }

  if (!lastSessionAt) {
    return (
      <span className="inline-block text-[11px] text-gray-400">
        Sin sesiones todavía
      </span>
    );
  }

  let label = '';
  let stale = false;
  try {
    const parsed = parseISO(lastSessionAt);
    label = formatDistanceToNow(parsed, { addSuffix: true, locale: es });
    stale = differenceInHours(new Date(), parsed) > STALE_HOURS;
  } catch {
    return (
      <span className="inline-block text-[11px] text-gray-400">
        Sin sesiones todavía
      </span>
    );
  }

  return (
    <span
      className={
        stale
          ? 'inline-block text-[11px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md'
          : 'inline-block text-[11px] text-gray-500'
      }
    >
      Última sesión: {label}
    </span>
  );
}
