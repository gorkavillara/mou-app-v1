import type { CohortPatient } from '@/lib/doctor-types';

export const mockCohortData: CohortPatient[] = [
  {
    id: 'P-2024-1847',
    name: 'Carlos Mendoza',
    diagnosis: 'Rehabilitación mano derecha',
    lastSession: '31 Ene 2025',
    adherence: 0.8,
    ifrm: 78,
    romAvg: 72,
    status: 'active'
  },
  {
    id: 'P-2024-1901',
    name: 'Laura Gómez',
    diagnosis: 'Síndrome del túnel carpiano',
    lastSession: '29 Ene 2025',
    adherence: 0.7,
    ifrm: 72,
    romAvg: 65,
    status: 'warning'
  },
  {
    id: 'P-2024-2044',
    name: 'Javier Ruiz',
    diagnosis: 'Fractura radial · postoperatorio',
    lastSession: '28 Ene 2025',
    adherence: 0.6,
    ifrm: 65,
    romAvg: 38,
    status: 'critical'
  },
  {
    id: 'P-2024-2120',
    name: 'María López',
    diagnosis: 'Lesión tendinosa',
    lastSession: '30 Ene 2025',
    adherence: 0.9,
    ifrm: 80,
    romAvg: 78,
    status: 'active'
  }
];
