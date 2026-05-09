import Link from 'next/link';
import { differenceInDays } from 'date-fns';
import { ArrowUpRight } from 'lucide-react';
import {
  fetchAlerts,
  fetchPatients,
  type AlertEntry,
  type StatusFilter,
} from '@/lib/doctor-api';
import { PatientsToolbar } from '@/components/doctor/PatientsToolbar';
import { AdherenceBar } from '@/components/doctor/AdherenceBar';
import { LastSessionBadge } from '@/components/doctor/LastSessionBadge';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseStatus(raw: unknown): StatusFilter {
  return raw === 'active' || raw === 'discharged' ? raw : 'all';
}

function asString(raw: unknown): string {
  return typeof raw === 'string' ? raw : '';
}

export default async function DoctorPatientsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const search = asString(sp.search);
  const status = parseStatus(sp.status);

  // F-16: GET /api/doctor/alerts returns the doctor's "stale" active
  // patients (last session older than threshold, capped at 30d by the API
  // schema, plus patients that have never sessioned). Joining client-side
  // keeps the patients list endpoint untouched (the parallel backend agent
  // is busy on B-18/B-19; we can fold this in server-side later). Patients
  // not in the response either have no active prescription, are
  // discharged, or sessioned within the threshold (= "al día").
  const [{ data, status: httpStatus }, { data: alertsData }] = await Promise.all([
    fetchPatients({ search, status }),
    fetchAlerts(720),
  ]);

  const isError = !data && httpStatus !== 401;
  const patients = data?.patients ?? [];
  const alertByPatient = new Map<string, AlertEntry>();
  for (const a of (alertsData?.patients ?? []) as AlertEntry[]) {
    alertByPatient.set(a.patient_id, a);
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pacientes</h1>
        <p className="text-sm text-gray-500">
          {data
            ? `${patients.length} ${patients.length === 1 ? 'paciente' : 'pacientes'}`
            : 'Cargando lista…'}
          {status === 'active' && ' activos'}
          {status === 'discharged' && ' dados de alta'}
          {search && ` · búsqueda: "${search}"`}
        </p>
      </header>

      <PatientsToolbar initialSearch={search} initialStatus={status} />

      {isError && <ApiError />}

      {!isError && patients.length === 0 && <EmptyState search={search} status={status} />}

      {!isError && patients.length > 0 && (
        <ul className="space-y-2">
          {patients.map((p) => {
            const days = differenceInDays(new Date(), new Date(p.started_at));
            const discharged = !!p.discharged_at;
            const totalPct = p.adherence?.total?.pct ?? p.adherence_pct;
            const weekPct = p.adherence?.week?.pct ?? null;
            const alert = alertByPatient.get(p.id);
            // If the patient is in the alerts list, we know their last
            // session timestamp (or null = never). Otherwise either they have
            // sessioned recently (good — show "al día") or they have no
            // active prescription. We can disambiguate via adherence: a
            // patient with a prescription that is NOT in the stale list
            // sessioned within 30 days.
            const hasPrescription = totalPct != null;
            const lastSessionAt = alert?.last_session_at ?? null;
            const isFresh = !alert && !hasPrescription;
            const isOnTrack = !alert && hasPrescription;

            return (
              <li key={p.id}>
                <Link
                  href={`/doctor/pacientes/${p.id}`}
                  className="group flex items-center gap-4 bg-white border border-gray-100 rounded-2xl px-4 py-3 hover:border-gray-200 hover:shadow-sm active:bg-gray-50 transition-shadow"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-gray-900 truncate">
                        {p.external_id}
                      </span>
                      <StatusBadge discharged={discharged} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {days === 0 ? 'alta hoy' : `día ${days} de tratamiento`}
                      {p.pathology_code && ` · ${p.pathology_code}`}
                    </p>
                  </div>

                  <div className="hidden sm:flex flex-col items-stretch w-48 gap-1">
                    {hasPrescription ? (
                      <>
                        <AdherenceBar pct={totalPct as number} />
                        <span className="text-[11px] text-gray-400 leading-tight">
                          7 d: {weekPct != null ? `${Math.round(weekPct)}%` : '—'}
                        </span>
                        <LastSessionBadge
                          lastSessionAt={lastSessionAt}
                          variant={isOnTrack ? 'on-track' : 'stale'}
                        />
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-gray-400">Sin prescripción</span>
                        <LastSessionBadge
                          lastSessionAt={lastSessionAt}
                          variant={isFresh ? 'fresh' : 'stale'}
                        />
                      </>
                    )}
                  </div>

                  <ArrowUpRight
                    size={18}
                    className="text-gray-300 group-hover:text-gray-500"
                  />
                </Link>

                <div className="sm:hidden px-4 py-2 space-y-1">
                  {hasPrescription ? (
                    <>
                      <AdherenceBar pct={totalPct as number} size="sm" />
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] text-gray-400">
                          7 d: {weekPct != null ? `${Math.round(weekPct)}%` : '—'}
                        </span>
                        <LastSessionBadge
                          lastSessionAt={lastSessionAt}
                          variant={isOnTrack ? 'on-track' : 'stale'}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs text-gray-400">Sin prescripción</span>
                      <LastSessionBadge
                        lastSessionAt={lastSessionAt}
                        variant={isFresh ? 'fresh' : 'stale'}
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ discharged }: { discharged: boolean }) {
  if (discharged) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 text-gray-600">
        Dado de alta
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-50 text-emerald-700">
      Activo
    </span>
  );
}

function EmptyState({ search, status }: { search: string; status: StatusFilter }) {
  const filtering = !!search || status !== 'all';
  return (
    <div className="relative rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
      <p className="text-sm font-medium text-gray-700">
        {filtering ? 'Sin resultados con esos filtros.' : 'Aún no hay pacientes.'}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        {filtering
          ? 'Prueba a cambiar la búsqueda o el estado.'
          : 'Da de alta el primero pulsando el botón "Nuevo paciente" arriba a la derecha.'}
      </p>
      {!filtering && (
        <div
          aria-hidden
          className="hidden sm:block absolute -top-3 right-6 text-2xl text-[#007AFF] rotate-45 select-none"
        >
          ↗
        </div>
      )}
    </div>
  );
}

function ApiError() {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-sm font-medium text-red-700">No se pudo cargar la lista de pacientes.</p>
      <p className="text-xs text-red-600 mt-0.5">
        Recarga la página. Si el problema persiste, avisa al equipo.
      </p>
    </div>
  );
}
