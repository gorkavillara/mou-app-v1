'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, X } from 'lucide-react';
import type { FingerName } from '@/lib/database.types';
import { FingerStatusPicker, fingerSummary } from './FingerStatusPicker';

/**
 * FB-1 (2026-06-06) — inline control to view/edit a patient's affected fingers
 * with status (lesionado / amputado). Replaces the single-finger
 * InjuredFingerControl.
 *
 * Sibling of SurgeryControl (same conventions: client island, optimistic value
 * with revert-on-error, disabled while saving, router.refresh() on success).
 * Collapsed it renders a badge summary ("Lesionados: Meñique, Anular ·
 * Amputado: Índice", or "Dedos: sin especificar") + a pencil. The pencil opens
 * the 5-row N/L/A editor. Saving PATCHes both arrays as a FULL replacement
 * (`[]` clears) — the backend validates no-overlap and stores them.
 */

type Props = {
  patientId: string;
  injuredFingers: FingerName[];
  amputatedFingers: FingerName[];
};

export function FingerStatusControl({
  patientId,
  injuredFingers,
  amputatedFingers,
}: Props) {
  const router = useRouter();
  const [injured, setInjured] = useState<FingerName[]>(injuredFingers);
  const [amputated, setAmputated] = useState<FingerName[]>(amputatedFingers);
  const [editing, setEditing] = useState(false);
  const [draftInjured, setDraftInjured] = useState<FingerName[]>(injuredFingers);
  const [draftAmputated, setDraftAmputated] = useState<FingerName[]>(amputatedFingers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = fingerSummary(injured, amputated);

  function openEditor() {
    setDraftInjured(injured);
    setDraftAmputated(amputated);
    setError(null);
    setEditing(true);
  }

  function cancelEditor() {
    setEditing(false);
    setError(null);
  }

  async function handleSave() {
    const prevInjured = injured;
    const prevAmputated = amputated;
    // Full-array replacement on both — the backend treats each array as
    // authoritative and validates no cross-overlap.
    setInjured(draftInjured);
    setAmputated(draftAmputated);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          injured_fingers: draftInjured,
          amputated_fingers: draftAmputated,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEditing(false);
      router.refresh();
    } catch {
      setInjured(prevInjured);
      setAmputated(prevAmputated);
      setError('No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 max-w-[320px]" data-testid="finger-status-control">
        <FingerStatusPicker
          injured={draftInjured}
          amputated={draftAmputated}
          disabled={saving}
          onChange={({ injured: ni, amputated: na }) => {
            setDraftInjured(ni);
            setDraftAmputated(na);
          }}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Guardar dedos"
            data-testid="finger-status-save"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-[#007AFF] text-white hover:bg-[#0069D9] disabled:opacity-50"
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            aria-label="Cancelar"
            data-testid="finger-status-cancel"
            disabled={saving}
            onClick={cancelEditor}
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <X size={15} />
          </button>
        </div>
        {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
      </div>
    );
  }

  const hasAny = injured.length > 0 || amputated.length > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="finger-status-control">
      <span
        data-testid="finger-status-summary"
        className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full ${
          hasAny ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-600'
        }`}
      >
        {summary}
      </span>
      <button
        type="button"
        data-testid="finger-status-edit"
        aria-label={hasAny ? 'Editar dedos' : 'Añadir dedos'}
        onClick={openEditor}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-900"
      >
        <Pencil size={12} />
        {hasAny ? 'Editar' : 'Añadir'}
      </button>
    </div>
  );
}
