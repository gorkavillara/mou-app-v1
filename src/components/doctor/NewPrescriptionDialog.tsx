'use client';

import { Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ExerciseSummary } from '@/lib/doctor-api';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type Props = {
  patientId: string;
  exercises: ExerciseSummary[];
};

export function NewPrescriptionDialog({ patientId, exercises }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState(false);

  const [exerciseId, setExerciseId] = useState<string>(exercises[0]?.id ?? '');
  const [sets, setSets] = useState<number>(3);
  const [reps, setReps] = useState<number>(20);
  const [sessionsPerDay, setSessionsPerDay] = useState<number>(8);
  const [durationDays, setDurationDays] = useState<number>(14);
  const [startsOn, setStartsOn] = useState<string>(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!exerciseId && exercises[0]) setExerciseId(exercises[0].id);
  }, [exercises, exerciseId]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  const totalReps =
    Math.max(0, sets) *
    Math.max(0, reps) *
    Math.max(0, sessionsPerDay) *
    Math.max(0, durationDays);

  function handleClose() {
    setOpen(false);
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!exerciseId) {
      setError('Selecciona un ejercicio.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}/prescriptions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          exercise_id: exerciseId,
          sets,
          reps_per_set: reps,
          sessions_per_day: sessionsPerDay,
          duration_days: durationDays,
          starts_on: startsOn,
        }),
      });

      if (res.status === 201 || res.status === 200) {
        handleClose();
        router.refresh();
        return;
      }
      const errBody = await res.json().catch(() => ({}) as { error?: string });
      setError(errBody?.error ?? 'No se pudo crear la prescripción.');
    } catch {
      setError('Error de red. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = exercises.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? 'Catálogo de ejercicios no disponible' : ''}
        className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-[#007AFF] hover:bg-blue-50 rounded-lg disabled:opacity-50"
      >
        <Plus size={16} />
        Añadir ejercicio
      </button>

      <dialog
        ref={dialogRef}
        onClose={handleClose}
        onCancel={handleClose}
        className="rounded-2xl p-0 backdrop:bg-gray-900/40 backdrop:backdrop-blur-sm w-[calc(100vw-2rem)] max-w-lg border border-gray-100 shadow-xl"
      >
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-lg font-semibold tracking-tight">Nueva prescripción</h2>
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-700"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>

          <div className="px-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-gray-500 ml-1">
                Ejercicio
              </label>
              <select
                value={exerciseId}
                onChange={(e) => setExerciseId(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-[#E5E5EA] rounded-[10px] text-[16px] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none"
              >
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Series" value={sets} min={1} onChange={setSets} />
              <NumberField label="Reps por serie" value={reps} min={1} onChange={setReps} />
              <NumberField
                label="Sesiones/día"
                value={sessionsPerDay}
                min={1}
                onChange={setSessionsPerDay}
              />
              <NumberField
                label="Duración (días)"
                value={durationDays}
                min={1}
                onChange={setDurationDays}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-gray-500 ml-1">
                Inicio
              </label>
              <input
                type="date"
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-[#E5E5EA] rounded-[10px] text-[16px] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none"
              />
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-sm text-blue-900">
              <span className="font-medium">{sets}</span> series ×{' '}
              <span className="font-medium">{reps}</span> reps ×{' '}
              <span className="font-medium">{sessionsPerDay}</span> sesiones/día durante{' '}
              <span className="font-medium">{durationDays}</span> días ={' '}
              <span className="font-semibold">{totalReps.toLocaleString('es-ES')}</span> reps
              totales
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="h-10 px-4 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !exerciseId}
              className="h-10 px-4 bg-[#007AFF] hover:bg-[#0069D9] active:bg-[#005BB5] disabled:bg-blue-300 text-white text-sm font-semibold rounded-xl"
            >
              {submitting ? 'Creando…' : 'Añadir'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-medium text-gray-500 ml-1">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="w-full h-11 px-3 bg-white border border-[#E5E5EA] rounded-[10px] text-[16px] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none"
      />
    </div>
  );
}
