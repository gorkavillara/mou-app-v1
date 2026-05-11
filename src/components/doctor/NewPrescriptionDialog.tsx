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
  // FIX-3 (manual testing 2026-05-11): la duración pasa a ser opcional.
  // Por defecto el tratamiento es abierto y termina cuando el doctor pulsa
  // "Finalizar rehabilitación" (DischargeButton). El backend acepta
  // `duration_days?: number` — si está en abierto, no enviamos la clave.
  const [hasEndDate, setHasEndDate] = useState<boolean>(false);
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

  const repsPerDay = Math.max(0, sets) * Math.max(0, reps) * Math.max(0, sessionsPerDay);
  const totalReps = repsPerDay * Math.max(0, durationDays);

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
    if (hasEndDate && (!Number.isFinite(durationDays) || durationDays < 1)) {
      setError('La duración debe ser un número de días positivo.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Open-ended treatments omit `duration_days` from the body — the
      // backend Zod schema is strict and prefers absence over null.
      const body: {
        exercise_id: string;
        sets: number;
        reps_per_set: number;
        sessions_per_day: number;
        starts_on: string;
        duration_days?: number;
      } = {
        exercise_id: exerciseId,
        sets,
        reps_per_set: reps,
        sessions_per_day: sessionsPerDay,
        starts_on: startsOn,
      };
      if (hasEndDate) body.duration_days = durationDays;

      const res = await fetch(`/api/doctor/patients/${patientId}/prescriptions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
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
        className="m-auto rounded-2xl p-0 backdrop:bg-gray-900/40 backdrop:backdrop-blur-sm w-[calc(100vw-2rem)] max-w-lg border border-gray-100 shadow-xl"
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
              <label
                htmlFor="prescription-exercise"
                className="block text-[13px] font-medium text-gray-500 ml-1"
              >
                Ejercicio
              </label>
              <select
                id="prescription-exercise"
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
              <div className="space-y-1.5">
                <label
                  htmlFor="prescription-starts-on"
                  className="block text-[13px] font-medium text-gray-500 ml-1"
                >
                  Inicio
                </label>
                <input
                  id="prescription-starts-on"
                  type="date"
                  value={startsOn}
                  onChange={(e) => setStartsOn(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-[#E5E5EA] rounded-[10px] text-[16px] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="block text-[13px] font-medium text-gray-500 ml-1">
                Final del tratamiento
              </span>
              <div
                role="radiogroup"
                aria-label="Final del tratamiento"
                className="inline-flex items-center bg-[#F2F2F7] p-1 rounded-[10px] w-full"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={!hasEndDate}
                  onClick={() => setHasEndDate(false)}
                  className={
                    'flex-1 h-9 px-3 text-sm font-medium rounded-lg transition-colors ' +
                    (!hasEndDate
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700')
                  }
                >
                  Sin fecha de fin
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={hasEndDate}
                  onClick={() => setHasEndDate(true)}
                  className={
                    'flex-1 h-9 px-3 text-sm font-medium rounded-lg transition-colors ' +
                    (hasEndDate
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700')
                  }
                >
                  Hasta una fecha
                </button>
              </div>
              {!hasEndDate && (
                <p className="text-xs text-gray-500 ml-1">
                  El tratamiento permanecerá activo hasta que pulses
                  &laquo;Finalizar rehabilitación&raquo;.
                </p>
              )}
            </div>

            {hasEndDate && (
              <NumberField
                label="Duración (días)"
                value={durationDays}
                min={1}
                onChange={setDurationDays}
              />
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-sm text-blue-900">
              <span className="font-medium">{sets}</span> series ×{' '}
              <span className="font-medium">{reps}</span> reps ×{' '}
              <span className="font-medium">{sessionsPerDay}</span> sesiones/día
              {hasEndDate ? (
                <>
                  {' '}durante <span className="font-medium">{durationDays}</span> días ={' '}
                  <span className="font-semibold">{totalReps.toLocaleString('es-ES')}</span>{' '}
                  reps totales
                </>
              ) : (
                <> (sin fecha de fin)</>
              )}
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
  const id = `nf-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[13px] font-medium text-gray-500 ml-1"
      >
        {label}
      </label>
      <input
        id={id}
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
