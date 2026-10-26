'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, X } from 'lucide-react';
import type { PathologyCode } from '@/lib/database.types';

/**
 * GORA-12 — inline control to view/edit a patient's pathology code.
 *
 * Sibling of SurgeryControl / FingerStatusControl (same conventions: client
 * island, optimistic value with revert-on-error, disabled while saving,
 * router.refresh() on success). Collapsed it renders a badge ("Patología:
 * Flexor", or "Patología: sin especificar" for empty patients) + a pencil that
 * opens a select. Saving PATCHes /api/doctor/patients/:id with
 * `{ pathology_code }` — `null` clears it.
 */

type Props = {
  patientId: string;
  pathologyCode: PathologyCode | null;
};

const PATHOLOGY_LABELS: Record<PathologyCode, string> = {
  flexor: 'Flexor',
  extensor: 'Extensor',
  otros: 'Otros',
};

export function PathologyControl({ patientId, pathologyCode }: Props) {
  const router = useRouter();
  const [pathology, setPathology] = useState<PathologyCode | null>(pathologyCode);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PathologyCode | ''>(pathologyCode ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEditor() {
    setDraft(pathology ?? '');
    setError(null);
    setEditing(true);
  }

  function cancelEditor() {
    setEditing(false);
    setError(null);
  }

  async function handleSave() {
    const next = draft ? draft : null;
    // PATCH rejects {} (400) — nothing changed, just close.
    if (next === pathology) {
      setEditing(false);
      return;
    }

    const prev = pathology;
    setPathology(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pathology_code: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEditing(false);
      router.refresh();
    } catch {
      setPathology(prev);
      setError('No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2" data-testid="pathology-control">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Patología"
            data-testid="pathology-select"
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value as PathologyCode | '')}
            className="h-8 px-2 text-[12px] bg-white border border-gray-200 rounded-lg text-gray-700 focus:border-[#007AFF] focus:outline-none disabled:opacity-50"
          >
            <option value="">Sin especificar</option>
            <option value="flexor">Flexor</option>
            <option value="extensor">Extensor</option>
            <option value="otros">Otros</option>
          </select>
          <button
            type="button"
            aria-label="Guardar patología"
            data-testid="pathology-save"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-[#007AFF] text-white hover:bg-[#0069D9] disabled:opacity-50"
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            aria-label="Cancelar"
            data-testid="pathology-cancel"
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

  return (
    <div className="flex items-center gap-2" data-testid="pathology-control">
      <span
        data-testid="pathology-line"
        className={
          pathology
            ? 'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-blue-50 text-blue-700'
            : 'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 text-gray-500'
        }
      >
        Patología: {pathology ? PATHOLOGY_LABELS[pathology] : 'sin especificar'}
      </span>
      <button
        type="button"
        data-testid="pathology-edit"
        aria-label={pathology ? 'Editar patología' : 'Añadir patología'}
        onClick={openEditor}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-900"
      >
        <Pencil size={12} />
        {pathology ? 'Editar' : 'Añadir patología'}
      </button>
    </div>
  );
}
