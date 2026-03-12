'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';

export default function PatientsList() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchPatients() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) {
        setLoading(false);
        return;
      }

      // Get doctor
      const { data: doctor } = await supabase
        .from('doctors')
        .select('id')
        .eq('email', user.email)
        .single();

      const doctorData = doctor as { id: string } | null;

      if (!doctorData?.id) {
        setLoading(false);
        return;
      }

      const doctorId = doctorData.id;

      // Get patients assigned to this doctor
      const { data: assignments } = await supabase
        .from('patient_assignments')
        .select(`
          patient:patients(
            id, name, diagnosis, ifrm, adherence, phone,
            insurance:insurances(name),
            sessions(startedAt)
          )
        `)
        .eq('doctorId', doctorId)
        .eq('status', 'ACTIVE');

      const patientList = assignments?.map((a: any) => {
        const sessions = a.patient?.sessions || [];
        const lastSession = sessions.length > 0 
          ? new Date(sessions[0].startedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
          : 'Sin sesiones';
        
        return {
          ...a.patient,
          lastSession,
          insuranceName: a.patient?.insurance?.name
        };
      }).filter(Boolean) || [];

      setPatients(patientList);
      setLoading(false);
    }

    fetchPatients();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
          <p className="text-gray-500">No hay pacientes asignados</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {patients.map(p =>
          <Link
            key={p.id}
            href={`/doctor/pacientes/${p.id}`}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:border-blue-200 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 font-mono">{p.id.slice(0, 12)}</p>
                <h2 className="text-lg font-bold text-gray-900">{p.name}</h2>
                <p className="text-sm text-gray-500">{p.diagnosis || 'Sin diagnóstico'}</p>
                {p.insuranceName && (
                  <p className="text-xs text-blue-500 mt-1">{p.insuranceName}</p>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">{p.ifrm || 0}</div>
                <div className="text-gray-400 text-sm">IFRM</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-gray-500">Última sesión: {p.lastSession}</span>
              <span className="text-gray-500">Adherencia: {Math.round((p.adherence || 0) * 100)}%</span>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
