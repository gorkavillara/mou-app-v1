'use client';

import type { FingerName } from '@/lib/database.types';

/**
 * FB-1 (2026-06-06) — shared per-finger status picker.
 *
 * Five rows (Pulgar, Índice, Medio, Anular, Meñique), each a 3-state segmented
 * control: N (Normal) · L (Lesionado) · A (Amputado). Same pill aesthetic as the
 * round-2 "Sin fecha de fin / Hasta una fecha" toggle.
 *
 * State is modelled as two arrays (`injured` / `amputated`) so it maps 1:1 onto
 * the backend contract (`patients.injured_fingers` / `patients.amputated_fingers`).
 * A finger absent from both arrays is Normal. The picker enforces mutual
 * exclusion: selecting L removes the finger from `amputated` and vice versa.
 *
 * Used by NewPatientDialog (create) and FingerStatusControl (inline edit).
 */

export type FingerState = 'normal' | 'injured' | 'amputated';

export const FINGER_ROWS: { value: FingerName; label: string }[] = [
  { value: 'pulgar', label: 'Pulgar' },
  { value: 'indice', label: 'Índice' },
  { value: 'medio', label: 'Medio' },
  { value: 'anular', label: 'Anular' },
  { value: 'menique', label: 'Meñique' },
];

export const FINGER_LABELS: Record<FingerName, string> = {
  pulgar: 'Pulgar',
  indice: 'Índice',
  medio: 'Medio',
  anular: 'Anular',
  menique: 'Meñique',
};

const SEGMENTS: { state: FingerState; short: string; aria: string }[] = [
  { state: 'normal', short: 'N', aria: 'Normal' },
  { state: 'injured', short: 'L', aria: 'Lesionado' },
  { state: 'amputated', short: 'A', aria: 'Amputado' },
];

export function stateOf(
  finger: FingerName,
  injured: FingerName[],
  amputated: FingerName[],
): FingerState {
  if (injured.includes(finger)) return 'injured';
  if (amputated.includes(finger)) return 'amputated';
  return 'normal';
}

export function applyState(
  finger: FingerName,
  next: FingerState,
  injured: FingerName[],
  amputated: FingerName[],
): { injured: FingerName[]; amputated: FingerName[] } {
  const nextInjured = injured.filter((f) => f !== finger);
  const nextAmputated = amputated.filter((f) => f !== finger);
  if (next === 'injured') nextInjured.push(finger);
  if (next === 'amputated') nextAmputated.push(finger);
  return { injured: nextInjured, amputated: nextAmputated };
}

type Props = {
  injured: FingerName[];
  amputated: FingerName[];
  disabled?: boolean;
  onChange: (next: { injured: FingerName[]; amputated: FingerName[] }) => void;
};

export function FingerStatusPicker({ injured, amputated, disabled, onChange }: Props) {
  return (
    <div className="space-y-1.5" data-testid="finger-status-picker">
      {FINGER_ROWS.map((row) => {
        const current = stateOf(row.value, injured, amputated);
        return (
          <div
            key={row.value}
            className="flex items-center justify-between gap-3"
            data-finger={row.value}
          >
            <span className="text-[14px] text-gray-700">{row.label}</span>
            <div
              role="radiogroup"
              aria-label={`Estado de ${row.label}`}
              className="inline-flex rounded-lg bg-gray-100 p-0.5"
            >
              {SEGMENTS.map((seg) => {
                const active = current === seg.state;
                return (
                  <button
                    key={seg.state}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`${row.label}: ${seg.aria}`}
                    data-testid={`finger-${row.value}-${seg.state}`}
                    disabled={disabled}
                    onClick={() =>
                      onChange(applyState(row.value, seg.state, injured, amputated))
                    }
                    className={`h-7 w-9 rounded-md text-[13px] font-semibold transition-colors disabled:opacity-50 ${
                      active
                        ? seg.state === 'injured'
                          ? 'bg-white text-orange-600 shadow-sm'
                          : seg.state === 'amputated'
                            ? 'bg-white text-gray-700 shadow-sm'
                            : 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {seg.short}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-gray-500 pt-1">
        L = lesionado (se mide) · A = amputado (se excluye)
      </p>
    </div>
  );
}

/** Summary line for collapsed display, e.g. "Lesionados: Meñique, Anular · Amputado: Índice". */
export function fingerSummary(injured: FingerName[], amputated: FingerName[]): string {
  const parts: string[] = [];
  if (injured.length > 0) {
    const word = injured.length === 1 ? 'Lesionado' : 'Lesionados';
    parts.push(`${word}: ${injured.map((f) => FINGER_LABELS[f]).join(', ')}`);
  }
  if (amputated.length > 0) {
    const word = amputated.length === 1 ? 'Amputado' : 'Amputados';
    parts.push(`${word}: ${amputated.map((f) => FINGER_LABELS[f]).join(', ')}`);
  }
  if (parts.length === 0) return 'Dedos: sin especificar';
  return parts.join(' · ');
}
