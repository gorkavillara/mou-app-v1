'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { InjuredFinger } from '@/lib/database.types';

/**
 * UX-4 — inline control to view/change a patient's operated finger.
 *
 * Renders a modest badge ("Dedo: Meñique") when set, plus a small <select>
 * that PATCHes /api/doctor/patients/:id on change. "Sin especificar" clears it
 * (sends `injured_finger: null`). Client island, like DischargeButton.
 */

type Props = {
  patientId: string;
  injuredFinger: InjuredFinger | null;
};

const OPTIONS: { value: InjuredFinger; label: string }[] = [
  { value: 'pulgar', label: 'Pulgar' },
  { value: 'indice', label: 'Índice' },
  { value: 'medio', label: 'Medio' },
  { value: 'anular', label: 'Anular' },
  { value: 'menique', label: 'Meñique' },
];

const LABELS: Record<InjuredFinger, string> = {
  pulgar: 'Pulgar',
  indice: 'Índice',
  medio: 'Medio',
  anular: 'Anular',
  menique: 'Meñique',
};

export function InjuredFingerControl({ patientId, injuredFinger }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<'' | InjuredFinger>(injuredFinger ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: '' | InjuredFinger) {
    const previous = value;
    setValue(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ injured_finger: next === '' ? null : next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch {
      setValue(previous);
      setError('No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2" data-testid="injured-finger-control">
      {value ? (
        <span
          data-testid="injured-finger-badge"
          className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-orange-50 text-orange-700"
        >
          Dedo: {LABELS[value]}
        </span>
      ) : null}
      <select
        aria-label="Dedo lesionado"
        data-testid="injured-finger-select"
        value={value}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value as '' | InjuredFinger)}
        className="h-8 px-2 text-[12px] bg-white border border-gray-200 rounded-lg text-gray-700 focus:border-[#007AFF] focus:outline-none disabled:opacity-50"
      >
        <option value="">Sin dedo</option>
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
    </div>
  );
}
