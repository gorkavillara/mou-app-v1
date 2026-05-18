import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { differenceInDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, QrCode } from 'lucide-react';
import {
  buildPatientAccessUrl,
  fetchExercisesCatalog,
  fetchPatientDetail,
  fetchPatientProgression,
  type AdherenceRow,
  type AdherenceTotal,
  type AdherenceWindow,
  type ExerciseSummary,
  type PatientDetail,
  type PrescriptionRow,
  type ProgressionResponse,
  type SessionRow,
} from '@/lib/doctor-api';
import { AdherenceBar } from '@/components/doctor/AdherenceBar';
import { DischargeButton } from '@/components/doctor/DischargeButton';
import { NewPrescriptionDialog } from '@/components/doctor/NewPrescriptionDialog';
import { CopyUrlButton, PrintButton } from '@/components/doctor/PatientAccessActions';
import { PrintableQRSheet } from '@/components/doctor/PrintableQRSheet';
import { ProgressionChart } from '@/components/doctor/ProgressionChart';

type Params = Promise<{ id: string }>;

export default async function PatientDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  // Progression call shares the page render. The API handles
  // from = patient.started_at, to = today defaults server-side, so we don't
  // need to thread params through unless the doctor narrows the window.
  const [{ data, status }, exercises, { data: progression }] = await Promise.all([
    fetchPatientDetail(id),
    fetchExercisesCatalog(),
    fetchPatientProgression(id),
  ]);

  if (status === 404) notFound();
  if (!data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">No se pudo cargar el paciente.</p>
          <p className="text-xs text-red-600 mt-0.5">Recarga la página.</p>
        </div>
      </div>
    );
  }

  const { patient, prescriptions, sessions, adherence } = data;
  const accessUrl = await buildPatientAccessUrl(patient.access_token);
  const days = differenceInDays(new Date(), new Date(patient.started_at));
  const discharged = !!patient.discharged_at;

  return (
    <>
      <div className="space-y-6 print:hidden">
        <BackLink />

        <Header
          externalId={patient.external_id}
          days={days}
          discharged={discharged}
          patientId={patient.id}
        />

        <AccessSection patient={patient} accessUrl={accessUrl} />

        <PrescriptionsSection
          prescriptions={prescriptions}
          patientId={patient.id}
          exercises={exercises}
        />

        <AdherenceSection adherence={adherence} />

        <ProgressionSection progression={progression} />

        <SessionsSection sessions={sessions} />
      </div>

      <PrintableQRSheet
        externalId={patient.external_id}
        qrSrc={`/api/doctor/patients/${patient.id}/qr.png`}
        issuedAt={patient.started_at}
      />
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/doctor"
      className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
    >
      <ChevronLeft size={16} />
      Pacientes
    </Link>
  );
}

function Header({
  externalId,
  days,
  discharged,
  patientId,
}: {
  externalId: string;
  days: number;
  discharged: boolean;
  patientId: string;
}) {
  return (
    <header className="flex items-start justify-between gap-3 flex-wrap">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight truncate">{externalId}</h1>
          {discharged ? (
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 text-gray-600">
              Dado de alta
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-50 text-emerald-700">
              Activo
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {days === 0 ? 'alta hoy' : `día ${days} de tratamiento`}
        </p>
      </div>

      <DischargeButton
        patientId={patientId}
        externalId={externalId}
        dischargedAt={discharged ? 'set' : null}
      />
    </header>
  );
}

function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

function AccessSection({
  patient,
  accessUrl,
}: {
  patient: PatientDetail;
  accessUrl: string;
}) {
  return (
    <Section title="Acceso del paciente" actions={<PrintButton />}>
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
          <Image
            src={`/api/doctor/patients/${patient.id}/qr.png`}
            alt={`QR del paciente ${patient.external_id}`}
            width={160}
            height={160}
            unoptimized
            className="w-full h-full object-contain"
          />
          <noscript>
            <div className="flex flex-col items-center gap-1 text-gray-400">
              <QrCode size={28} />
              <span className="text-[11px]">QR pendiente</span>
            </div>
          </noscript>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
              URL del paciente
            </p>
            <p className="text-sm text-gray-900 break-all bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 font-mono">
              {accessUrl}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CopyUrlButton url={accessUrl} />
          </div>
        </div>
      </div>
    </Section>
  );
}

function PrescriptionsSection({
  prescriptions,
  patientId,
  exercises,
}: {
  prescriptions: PrescriptionRow[];
  patientId: string;
  exercises: ExerciseSummary[];
}) {
  return (
    <Section
      title="Prescripciones activas"
      actions={<NewPrescriptionDialog patientId={patientId} exercises={exercises} />}
    >
      {prescriptions.length === 0 ? (
        <p className="text-sm text-gray-500">
          Sin prescripciones. Pulsa <span className="font-medium">Añadir ejercicio</span> para
          configurar la pauta.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {prescriptions.map((rx) => {
            const dose = `${rx.sets}×${rx.reps_per_set} · ${rx.sessions_per_day} sesiones/día`;
            const remaining = daysRemaining(rx.starts_on, rx.duration_days);
            return (
              <li
                key={rx.id}
                className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {rx.exercise?.name ?? 'Ejercicio'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{dose}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium text-gray-700">
                    {remaining === null
                      ? 'abierto'
                      : remaining > 0
                        ? `${remaining} ${remaining === 1 ? 'día' : 'días'} restantes`
                        : 'finalizada'}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    inicio {formatShortDate(rx.starts_on)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function AdherenceSection({ adherence }: { adherence: AdherenceRow | null }) {
  return (
    <Section title="Adherencia">
      {adherence ? (
        // B-13 / D12: total adherence is the headline number ("¿está
        // cumpliendo su tratamiento?"); the last-7-days view is the early
        // warning ("¿se está enfriando esta semana?"). Two cards side by side
        // on desktop, stacked on mobile.
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AdherenceCard label="Total" {...cardPropsFor(adherence.total)} />
          <AdherenceCard label="Últimos 7 días" {...cardPropsFor(adherence.week)} />
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          La adherencia se calculará cuando el paciente tenga al menos una prescripción.
        </p>
      )}
    </Section>
  );
}

function cardPropsFor(window: AdherenceTotal | AdherenceWindow): {
  pct: number | null;
  sub: string;
} {
  return {
    pct: window.pct,
    sub: `${window.completed}/${window.target} sesiones`,
  };
}

function AdherenceCard({
  label,
  pct,
  sub,
}: {
  label: string;
  pct: number | null;
  sub: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-gray-900 mt-1">
        {pct != null ? `${Math.round(pct)}%` : '—'}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
      {pct != null && (
        <div className="mt-3">
          <AdherenceBar pct={pct} showLabel={false} />
        </div>
      )}
    </div>
  );
}

function ProgressionSection({ progression }: { progression: ProgressionResponse | null }) {
  return (
    <Section title="Progresión angular">
      <ProgressionChart data={progression} />
    </Section>
  );
}

function SessionsSection({ sessions }: { sessions: SessionRow[] }) {
  if (sessions.length === 0) {
    return (
      <Section title="Sesiones recientes">
        <p className="text-sm text-gray-500">El paciente todavía no ha completado sesiones.</p>
      </Section>
    );
  }

  return (
    <Section title="Sesiones recientes">
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500">
              <th className="px-2 py-2 font-medium">Fecha</th>
              <th className="px-2 py-2 font-medium">Ejercicio</th>
              <th className="px-2 py-2 font-medium">Reps</th>
              <th className="px-2 py-2 font-medium text-right">Completado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="px-2 py-2 text-gray-700 whitespace-nowrap">
                  {formatDateTime(s.started_at)}
                </td>
                <td className="px-2 py-2 text-gray-700">
                  {s.prescription?.exercise?.code ?? '—'}
                </td>
                <td className="px-2 py-2 text-gray-700 tabular-nums">
                  {s.reps_completed}/{s.target_reps}
                </td>
                <td className="px-2 py-2 text-right tabular-nums font-medium text-gray-900">
                  {Math.round(s.completion_pct)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function daysRemaining(startsOn: string, durationDays: number | null): number | null {
  // null durationDays = open-ended treatment (manual-testing 2026-05-11);
  // we return null so the UI can render "abierto" instead of a day count.
  if (durationDays === null) return null;
  try {
    const start = parseISO(startsOn);
    const elapsed = differenceInDays(new Date(), start);
    return Math.max(0, durationDays - elapsed);
  } catch {
    return 0;
  }
}

function formatShortDate(iso: string) {
  try {
    return format(parseISO(iso), "d 'de' LLL", { locale: es });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string) {
  try {
    return format(parseISO(iso), "d LLL · HH:mm", { locale: es });
  } catch {
    return iso;
  }
}
