'use client';

import type { FingerName } from '@/lib/database.types';

/**
 * FB-1 (2026-06-06) — shared per-finger status picker.
 * FB-3 (2026-06-15) — simplified to a 2-state N/L control.
 *
 * Five rows (Pulgar, Índice, Medio, Anular, Meñique), each a 2-state segmented
 * control: N (Normal) · L (Lesionado). Same pill aesthetic as the round-2
 * "Sin fecha de fin / Hasta una fecha" toggle.
 *
 * Decisión FB-3: los amputados se tratan como lesionados (se miden igual), por
 * lo que el estado "Amputado" desaparece del UI. El picker ahora modela un
 * único array `injured` que mapea 1:1 sobre `patients.injured_fingers`. Un dedo
 * ausente del array es Normal.
 *
 * Used by NewPatientDialog (create) and FingerStatusControl (inline edit).
 */

export type FingerState = 'normal' | 'injured';

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
];

export function stateOf(finger: FingerName, injured: FingerName[]): FingerState {
  return injured.includes(finger) ? 'injured' : 'normal';
}

export function applyState(
  finger: FingerName,
  next: FingerState,
  injured: FingerName[],
): FingerName[] {
  const nextInjured = injured.filter((f) => f !== finger);
  if (next === 'injured') nextInjured.push(finger);
  return nextInjured;
}

type Props = {
  injured: FingerName[];
  disabled?: boolean;
  onChange: (next: FingerName[]) => void;
};

export function FingerStatusPicker({ injured, disabled, onChange }: Props) {
  return (
    <div className="space-y-1.5" data-testid="finger-status-picker">
      {FINGER_ROWS.map((row) => {
        const current = stateOf(row.value, injured);
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
                    onClick={() => onChange(applyState(row.value, seg.state, injured))}
                    className={`h-7 w-9 rounded-md text-[13px] font-semibold transition-colors disabled:opacity-50 ${
                      active
                        ? seg.state === 'injured'
                          ? 'bg-white text-orange-600 shadow-sm'
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
      <p className="text-[11px] text-gray-500 pt-1">L = lesionado (se mide)</p>
    </div>
  );
}

/** Summary line for collapsed display, e.g. "Lesionados: Meñique, Anular". */
export function fingerSummary(injured: FingerName[]): string {
  if (injured.length === 0) return 'Dedos: sin especificar';
  const word = injured.length === 1 ? 'Lesionado' : 'Lesionados';
  return `${word}: ${injured.map((f) => FINGER_LABELS[f]).join(', ')}`;
}
