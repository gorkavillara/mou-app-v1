'use client';

import { Search, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { NewPatientDialog } from './NewPatientDialog';

type Status = 'all' | 'active' | 'discharged';

const STATUS_LABEL: Record<Status, string> = {
  all: 'Todos',
  active: 'Activos',
  discharged: 'Altas',
};

export function PatientsToolbar({
  initialSearch,
  initialStatus,
}: {
  initialSearch: string;
  initialStatus: Status;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Debounce search input → push URL.
  useEffect(() => {
    if (search === initialSearch) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search) next.set('search', search);
      else next.delete('search');
      const qs = next.toString();
      router.replace(qs ? `/doctor?${qs}` : '/doctor');
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setStatus(s: Status) {
    const next = new URLSearchParams(params.toString());
    if (s === 'all') next.delete('status');
    else next.set('status', s);
    const qs = next.toString();
    router.replace(qs ? `/doctor?${qs}` : '/doctor');
  }

  const statuses: Status[] = ['all', 'active', 'discharged'];

  return (
    <>
      <div className="sticky top-14 z-5 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-gray-50/90 backdrop-blur border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="search"
              inputMode="search"
              placeholder="Buscar por ID de paciente"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 bg-white border border-gray-200 rounded-xl text-[15px] placeholder-gray-400 focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex bg-white border border-gray-200 rounded-xl p-1">
              {statuses.map((s) => {
                const active = s === initialStatus;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={
                      active
                        ? 'px-3 h-8 text-sm font-medium rounded-lg bg-[#007AFF] text-white'
                        : 'px-3 h-8 text-sm font-medium rounded-lg text-gray-600 hover:text-gray-900'
                    }
                  >
                    {STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              data-testid="new-patient-btn"
              className="inline-flex items-center gap-1.5 h-10 px-4 bg-[#007AFF] hover:bg-[#0069D9] active:bg-[#005BB5] text-white text-sm font-semibold rounded-xl whitespace-nowrap"
            >
              <UserPlus size={16} />
              <span>Nuevo paciente</span>
            </button>
          </div>
        </div>
      </div>

      <NewPatientDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
