'use client';

import React from 'react';
import { Users, User } from 'lucide-react';
import { PatientCard } from './PatientCard';
import type { CohortPatient } from '@/lib/doctor-types';
import { mockCohortData } from '@/data/mock-cohort';

interface CohorteGridProps {
  patients?: CohortPatient[];
  onPatientSelect?: (patient: CohortPatient) => void;
}

export function CohorteGrid({ patients = mockCohortData, onPatientSelect }: CohorteGridProps) {
  const handlePatientClick = (patient: CohortPatient) => {
    onPatientSelect?.(patient);
  };

  const activeCount = patients.filter(p => p.status === 'active').length;
  const warningCount = patients.filter(p => p.status === 'warning').length;
  const criticalCount = patients.filter(p => p.status === 'critical').length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-blue-600" />
          <h3 className="text-base font-bold text-gray-900">Cohorte de Pacientes</h3>
        </div>
        <span className="text-sm text-gray-500">{patients.length} activos</span>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-gray-600">{activeCount} OK</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-gray-600">{warningCount} Warn</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-gray-600">{criticalCount} Crit</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {patients.length > 0 ? (
          patients.map(patient => (
            <PatientCard 
              key={patient.id} 
              patient={patient}
              onClick={handlePatientClick}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <User size={32} className="mb-2" />
            <p className="text-sm">No hay pacientes asignados</p>
          </div>
        )}
      </div>
    </div>
  );
}
