'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Check, Pencil, X } from 'lucide-react';

/**
 * Round 3 — inline control to view/edit a patient's intervention date and a
 * short surgical descriptor.
 *
 * Sibling of InjuredFingerControl (same conventions: client island, optimistic
 * value with revert-on-error, disabled while saving, router.refresh() on
 * success). When either field is set it renders a compact line the surgeon
 * asked for, e.g. "IQ 19/5/26 · Tenorrafia FDP 5º dedo", plus a pencil affordance
 * that opens inline inputs. Saving PATCHes /api/doctor/patients/:id with only
 * the changed fields (null clears one).
 */

type Props = {
  patientId: string;
  surgeryDate: string | null;
  surgeryNote: string | null;
};

const NOTE_MAX = 120;

function formatSurgeryLine(date: string | null, note: string | null): string | null {
  const parts: string[] = [];
  if (date) {
    try {
      parts.push(`IQ ${format(parseISO(date), 'd/M/yy')}`);
    } catch {
      parts.push(`IQ ${date}`);
    }
  }
  if (note) parts.push(note);
  if (parts.length === 0) return null;
  return parts.join(' · ');
}

export function SurgeryControl({ patientId, surgeryDate, surgeryNote }: Props) {
  const router = useRouter();
  const [date, setDate] = useState<string | null>(surgeryDate);
  const [note, setNote] = useState<string | null>(surgeryNote);
  const [editing, setEditing] = useState(false);
  const [draftDate, setDraftDate] = useState(surgeryDate ?? '');
  const [draftNote, setDraftNote] = useState(surgeryNote ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const line = formatSurgeryLine(date, note);

  function openEditor() {
    setDraftDate(date ?? '');
    setDraftNote(note ?? '');
    setError(null);
    setEditing(true);
  }

  function cancelEditor() {
    setEditing(false);
    setError(null);
  }

  async function handleSave() {
    const nextDate = draftDate ? draftDate : null;
    const nextNote = draftNote.trim() ? draftNote.trim() : null;

    // PATCH rejects {} (400) — nothing changed, just close.
    const body: { surgery_date?: string | null; surgery_note?: string | null } = {};
    if (nextDate !== date) body.surgery_date = nextDate;
    if (nextNote !== note) body.surgery_note = nextNote;
    if (Object.keys(body).length === 0) {
      setEditing(false);
      return;
    }

    const prevDate = date;
    const prevNote = note;
    setDate(nextDate);
    setNote(nextNote);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEditing(false);
      router.refresh();
    } catch {
      setDate(prevDate);
      setNote(prevNote);
      setError('No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2" data-testid="surgery-control">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label="Fecha de intervención"
            data-testid="surgery-date-input"
            value={draftDate}
            disabled={saving}
            onChange={(e) => setDraftDate(e.target.value)}
            className="h-8 px-2 text-[12px] bg-white border border-gray-200 rounded-lg text-gray-700 focus:border-[#007AFF] focus:outline-none disabled:opacity-50"
          />
          <input
            type="text"
            aria-label="Cirugía"
            data-testid="surgery-note-input"
            maxLength={NOTE_MAX}
            placeholder="Tenorrafia FDP 5º dedo"
            value={draftNote}
            disabled={saving}
            onChange={(e) => setDraftNote(e.target.value)}
            className="h-8 px-2 text-[12px] bg-white border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:border-[#007AFF] focus:outline-none disabled:opacity-50 min-w-[12rem]"
          />
          <button
            type="button"
            aria-label="Guardar cirugía"
            data-testid="surgery-save"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-[#007AFF] text-white hover:bg-[#0069D9] disabled:opacity-50"
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            aria-label="Cancelar"
            data-testid="surgery-cancel"
            disabled={saving}
            onClick={cancelEditor}
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <X size={15} />
          </button>
        </div>
        <p className="text-[11px] text-gray-400">Solo descripción clínica. Nunca el nombre del paciente.</p>
        {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" data-testid="surgery-control">
      {line ? (
        <span
          data-testid="surgery-line"
          className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-blue-50 text-blue-700"
        >
          {line}
        </span>
      ) : null}
      <button
        type="button"
        data-testid="surgery-edit"
        aria-label={line ? 'Editar cirugía' : 'Añadir cirugía'}
        onClick={openEditor}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-900"
      >
        <Pencil size={12} />
        {line ? 'Editar' : 'Añadir cirugía'}
      </button>
    </div>
  );
}
