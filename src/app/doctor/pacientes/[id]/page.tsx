'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function PatientDetail() {
  const params = useParams() as { id?: string };
  const patientId = params?.id;
  
  const [patient, setPatient] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      if (!patientId) {
        setLoading(false);
        return;
      }

      // Fetch patient
      const { data: patientData } = await supabase
        .from('patients')
        .select('*, insurance:insurances(name)')
        .eq('id', patientId)
        .single();

      setPatient(patientData);

      // Fetch sessions
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('*')
        .eq('patientId', patientId)
        .order('startedAt', { ascending: false })
        .limit(10);

      setSessions(sessionsData || []);

      // Fetch notes
      const { data: notesData } = await supabase
        .from('session_notes')
        .select('*')
        .eq('patientId', patientId)
        .order('createdAt', { ascending: false })
        .limit(5);

      setNotes(notesData || []);

      // Fetch tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('patientId', patientId)
        .order('createdAt', { ascending: false })
        .limit(5);

      setTasks(tasksData || []);
      setLoading(false);
    }

    fetchData();
  }, [patientId, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Paciente</h1>
          <Link href="/doctor/pacientes" className="text-blue-600 text-sm font-semibold">
            Volver a lista
          </Link>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-900 font-semibold">Paciente no encontrado</p>
        </div>
      </div>
    );
  }

  const sessionData = sessions.slice(0, 7).reverse().map((s, i) => ({
    session: `S${i + 1}`,
    flexion: s.maxFlexion || 0,
    objetivo: 75
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Paciente</h1>
        <Link href="/doctor/pacientes" className="text-blue-600 text-sm font-semibold">
          Volver a lista
        </Link>
      </div>

      {/* Patient Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 font-mono">{patient.id?.slice(0, 12)}</p>
            <h2 className="text-xl font-bold text-gray-900">{patient.name}</h2>
            <p className="text-sm text-gray-500">{patient.diagnosis || 'Sin diagnóstico'}</p>
            {patient.insurance?.name && (
              <p className="text-xs text-blue-500 mt-1">{patient.insurance.name}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-gray-900">{patient.ifrm || 0}</div>
            <div className="text-gray-400 text-sm">IFRM</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Adherencia:</span>
            <span className="ml-2 font-semibold">{Math.round((patient.adherence || 0) * 100)}%</span>
          </div>
          <div>
            <span className="text-gray-500">Dolor:</span>
            <span className="ml-2 font-semibold">{patient.pain_level || 0}/10</span>
          </div>
          <div>
            <span className="text-gray-500">Teléfono:</span>
            <span className="ml-2 font-semibold">{patient.phone}</span>
          </div>
        </div>
      </div>

      {/* Sessions Chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Historial de Sesiones</h3>
        {sessions.length > 0 ? (
          <div className="h-64">
            <p className="text-sm text-gray-500">{sessions.length} sesiones registradas</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No hay sesiones registradas</p>
        )}
      </div>

      {/* Notes and Tasks */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Notas</h3>
          {notes.length > 0 ? (
            <div className="space-y-3">
              {notes.map(note => (
                <div key={note.id} className="border-b border-gray-100 pb-3">
                  <p className="text-sm text-gray-700">{note.content?.slice(0, 100)}...</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(note.createdAt).toLocaleDateString('es-ES')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No hay notas</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Tareas</h3>
          {tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map(task => (
                <div key={task.id} className="border-b border-gray-100 pb-3">
                  <p className="text-sm text-gray-700">{task.title}</p>
                  <p className="text-xs text-gray-400 mt-1">Estado: {task.status}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No hay tareas</p>
          )}
        </div>
      </div>
    </div>
  );
}
