'use client';

import React from 'react';
import type { CohortPatient } from '@/lib/doctor-types';

interface PatientCardProps {
  patient: CohortPatient;
  onClick?: (patient: CohortPatient) => void;
}

export function PatientCard({ patient, onClick }: PatientCardProps) {
  const statusColors = {
    active: 'bg-green-100 border-green-300',
    warning: 'bg-yellow-100 border-yellow-300',
    critical: 'bg-red-100 border-red-300'
  };

  const statusDot = {
    active: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500'
  };

  return (
    <div 
      onClick={() => onClick?.(patient)}
      className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${statusColors[patient.status]}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${statusDot[patient.status]}`} />
          <span className="font-semibold text-gray-900 text-sm">{patient.name}</span>
        </div>
        <span className="text-xs text-gray-500 font-mono">{patient.id}</span>
      </div>
      
      <p className="text-xs text-gray-600 mb-3 line-clamp-2">{patient.diagnosis}</p>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-white/70 rounded-lg p-2">
          <span className="text-gray-400 block mb-0.5">Adherencia</span>
          <span className="font-bold text-gray-900">{Math.round(patient.adherence * 100)}%</span>
        </div>
        <div className="bg-white/70 rounded-lg p-2">
          <span className="text-gray-400 block mb-0.5">ROM prom</span>
          <span className="font-bold text-gray-900">{patient.romAvg}°</span>
        </div>
      </div>
      
      <div className="mt-3 text-xs text-gray-500">
        Última sesión: {patient.lastSession}
      </div>
    </div>
  );
}
