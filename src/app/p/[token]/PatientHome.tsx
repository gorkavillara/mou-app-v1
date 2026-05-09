'use client';

import Link from 'next/link';
import { ArrowRight, Hand } from 'lucide-react';
import type { PatientHomePayload } from './types';

type Props = {
  token: string;
} & PatientHomePayload;

const SPANISH_DAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

const SPANISH_MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function formatToday(d = new Date()): string {
  const dayName = SPANISH_DAYS[d.getDay()];
  const month = SPANISH_MONTHS[d.getMonth()];
  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${d.getDate()} de ${month}`;
}

export function PatientHome({ token, patient, prescriptions, today }: Props) {
  const completed = today.sessions_completed;
  const target = today.sessions_target;
  const sessionLabel =
    completed >= target
      ? 'Sesión completada hoy'
      : `Sesión ${completed + 1} de ${target}`;

  return (
    <main className="min-h-screen bg-[#F2F2F7] text-gray-900">
      <div className="mx-auto w-full max-w-[520px] px-5 pt-8 pb-16">
        {/* Top bar */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#007AFF] text-white">
              <Hand size={18} strokeWidth={2.2} aria-hidden />
            </span>
            <span className="text-[17px] font-semibold tracking-tight">Mou</span>
          </div>
          <span className="text-[13px] text-gray-500" aria-label="Fecha de hoy">
            {formatToday()}
          </span>
        </header>

        {/* Progress headline */}
        <section className="mt-8" data-testid="patient-progress">
          <p className="text-[13px] font-medium uppercase tracking-wider text-[#007AFF]">
            Hoy
          </p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight">
            {sessionLabel}
          </h1>
          <p className="mt-2 text-[15px] text-gray-600">
            Paciente {patient.external_id}
          </p>
        </section>

        {/* Prescriptions */}
        <section className="mt-8 space-y-4" data-testid="prescriptions-list">
          {prescriptions.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-gray-600">
              No tienes ejercicios prescritos hoy.
            </div>
          ) : (
            prescriptions.map((p) => {
              const reps = p.sets * p.reps_per_set;
              const exercise = p.exercise;
              return (
                <article
                  key={p.id}
                  className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  data-testid={`prescription-${p.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-[19px] font-semibold tracking-tight">
                        {exercise?.name ?? 'Ejercicio'}
                      </h2>
                      <p className="mt-1 text-[13px] font-medium text-[#007AFF]">
                        {reps} repeticiones
                      </p>
                    </div>
                  </div>
                  {exercise?.description ? (
                    <p className="mt-3 text-[15px] leading-relaxed text-gray-600">
                      {exercise.description}
                    </p>
                  ) : null}
                  <div className="mt-5">
                    <Link
                      href={`/p/${token}/exercise/${p.id}`}
                      data-testid={`start-${p.id}`}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#007AFF] text-[17px] font-semibold text-white transition active:bg-[#005BB5]"
                    >
                      Empezar
                      <ArrowRight size={18} strokeWidth={2.4} aria-hidden />
                    </Link>
                  </div>
                </article>
              );
            })
          )}
        </section>

        {/* Footer summary */}
        <p className="mt-8 text-center text-[13px] text-gray-500">
          {completed === 0
            ? `Has hecho 0 sesiones hoy de ${target} previstas.`
            : `Has hecho ${completed} ${
                completed === 1 ? 'sesión' : 'sesiones'
              } hoy de ${target} previstas.`}
        </p>
      </div>
    </main>
  );
}
