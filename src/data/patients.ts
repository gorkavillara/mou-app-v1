import type { HandSignature } from '@/lib/hand-tracking';
import type { ExerciseSchedule, LowBackSchedule } from '@/lib/notifications';

 export type Patient = {
   id: string;
   name: string;
   email: string;
   diagnosis: string;
   clinic: string;
   lastSession: string;
   ifrm: number;
   adherence: number;
   painLevel: number;
   handSignature?: HandSignature;
   exerciseSchedule?: ExerciseSchedule;
   lowBackSchedule?: LowBackSchedule;
 };
 
  export const patients: Patient[] = [
    {
      id: 'P-2024-1847',
      name: 'Carlos Mendoza',
      email: 'c.mendoza@gmail.com',
      diagnosis: 'Rehabilitación mano derecha',
      clinic: 'Centro de Rehabilitación San José',
      lastSession: 'S7 · 31 Ene 2025',
      ifrm: 78,
      adherence: 0.8,
      painLevel: 2,
      exerciseSchedule: { times: ['10:00', '16:00'], days: [1, 2, 3, 4, 5] }
    },
    {
      id: 'P-2024-1901',
      name: 'Laura Gómez',
      email: 'l.gomez@gmail.com',
      diagnosis: 'Síndrome del túnel carpiano',
      clinic: 'Clínica Las Hadas',
      lastSession: 'S5 · 29 Ene 2025',
      ifrm: 72,
      adherence: 0.7,
      painLevel: 3,
      lowBackSchedule: { startDate: '2025-02-20', endDate: '2025-03-05' }
    },
    {
      id: 'P-2024-2044',
      name: 'Javier Ruiz',
      email: 'j.ruiz@gmail.com',
      diagnosis: 'Fractura radial · postoperatorio',
      clinic: 'Hospital Norte',
      lastSession: 'S3 · 28 Ene 2025',
      ifrm: 65,
      adherence: 0.6,
      painLevel: 5,
      exerciseSchedule: { times: ['09:00', '15:00', '18:00'], days: [1, 3, 5] }
    },
    {
      id: 'P-2024-2120',
      name: 'María López',
      email: 'm.lopez@gmail.com',
      diagnosis: 'Lesión tendinosa',
      clinic: 'Centro FisioFit',
      lastSession: 'S6 · 30 Ene 2025',
      ifrm: 80,
      adherence: 0.9,
      painLevel: 1
    }
  ];
