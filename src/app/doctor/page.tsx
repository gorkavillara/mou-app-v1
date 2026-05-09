import Link from 'next/link';
import { differenceInDays } from 'date-fns';
import { ArrowUpRight } from 'lucide-react';
import { fetchPatients, type StatusFilter } from '@/lib/doctor-api';
import { PatientsToolbar } from '@/components/doctor/PatientsToolbar';
import { AdherenceBar } from '@/components/doctor/AdherenceBar';

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

  const { data, status: httpStatus } = await fetchPatients({ search, status });

  const isError = !data && httpStatus !== 401;
  const patients = data?.patients ?? [];

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

                  <div className="hidden sm:block w-48">
                    {p.adherence_pct == null ? (
                      <span className="text-xs text-gray-400">Sin prescripción</span>
                    ) : (
                      <AdherenceBar pct={p.adherence_pct} />
                    )}
                  </div>

                  <ArrowUpRight
                    size={18}
                    className="text-gray-300 group-hover:text-gray-500"
                  />
                </Link>

                <div className="sm:hidden px-4 py-2">
                  {p.adherence_pct == null ? (
                    <span className="text-xs text-gray-400">Sin prescripción</span>
                  ) : (
                    <AdherenceBar pct={p.adherence_pct} size="sm" />
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
