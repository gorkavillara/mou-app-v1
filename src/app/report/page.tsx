'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Download } from 'lucide-react';
import { PatientHeader } from '@/components/report/PatientHeader';
import { ReportSummary } from '@/components/report/ReportSummary';
import { ProgressSection } from '@/components/report/ProgressSection';
import { ObservationsSection } from '@/components/report/ObservationsSection';
import { RecommendationsSection } from '@/components/report/RecommendationsSection';
import { AppNav } from '@/components/AppNav';
import { jsPDF } from 'jspdf';
import { createClient } from '@/lib/supabase';

const supabase = createClient();

type Patient = {
  id: string;
  name: string;
  ifrm?: number;
} | null;

type Session = {
  id: string;
  startedAt: string;
  exerciseId: string;
  completedReps: number;
  targetReps: number;
};

type Metric = {
  id: string;
  date: string;
  ifrm: number;
  adherence: number;
};

export default function Report() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) {
        setLoading(false);
        return;
      }

      const { data: patientData } = await supabase
        .from('patients')
        .select('*')
        .eq('email', user.email)
        .single() as { data: Patient };

      if (patientData && patientData.id) {
        setPatient(patientData);

        // Fetch sessions
        const { data: sessionsData } = await supabase
          .from('sessions')
          .select('*')
          .eq('patientId', patientData.id)
          .order('startedAt', { ascending: false })
          .limit(30);

        setSessions(sessionsData || []);

        // Fetch metrics
        const { data: metricsData } = await supabase
          .from('patient_metrics')
          .select('*')
          .eq('patientId', patientData.id)
          .order('date', { ascending: false })
          .limit(30);

        setMetrics(metricsData || []);
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const patientName = patient?.name || 'Paciente';
    const patientId = patient?.id ? `P-${patient.id.slice(0, 8).toUpperCase()}` : 'P-00000000';
    const currentDate = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    
    doc.setFontSize(16);
    doc.text('Informe de Rehabilitación', 20, 20);
    doc.setFontSize(11);
    doc.text(`Paciente: ${patientName}`, 20, 35);
    doc.text(`ID: ${patientId}`, 20, 42);
    doc.text(`Período: ${currentDate}`, 20, 49);
    doc.text('Centro: Centro de Rehabilitación Mou', 20, 56);
    
    // Calculate stats
    const latestMetric = metrics[0];
    const ifrm = latestMetric?.ifrm || patient?.ifrm || 0;
    const adherence = latestMetric?.adherence || 0;
    
    doc.setFontSize(13);
    doc.text('Resumen', 20, 72);
    doc.setFontSize(11);
    doc.text(`- IFRM: ${ifrm}/100`, 20, 82);
    doc.text(`- Adherencia: ${adherence}%`, 20, 90);
    doc.text(`- Sesiones completadas: ${sessions.length}`, 20, 98);
    
    doc.setFontSize(13);
    doc.text('Observaciones', 20, 114);
    doc.setFontSize(11);
    doc.text('- Progreso registrado según ejercicios completados', 20, 122);
    
    doc.setFontSize(13);
    doc.text('Recomendaciones', 20, 138);
    doc.text('- Continuar con la rutina de ejercicios asignada', 20, 146);
    doc.text('- Mantener sesiones regulares para mejor recuperación', 20, 154);
    
    doc.save(`informe_${patientName.replace(' ', '_')}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] pb-24 md:pb-8 md:pl-[220px] font-sans">
        <AppNav active="/report" />
        <div className="flex items-center justify-center h-64 pt-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const currentDate = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric', day: 'numeric' });

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-24 md:pb-8 md:pl-[220px] font-sans">
      <AppNav active="/report" />

      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 h-14 flex items-center justify-between">
        <button className="flex items-center text-blue-600 font-medium text-base active:opacity-70 transition-opacity">
          <ChevronLeft size={22} className="-ml-1" />
          Atrás
        </button>
        <h1 className="text-gray-900 font-semibold text-base">
          Informe de Rehabilitación
        </h1>
        <button
          onClick={handleExportPdf}
          className="w-8 h-8 flex items-center justify-center text-blue-600 active:opacity-70 transition-opacity"
        >
          <Download size={20} />
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8">
        <PatientHeader
          name={patient?.name || 'Paciente'}
          id={patient?.id ? `P-${patient.id.slice(0, 8).toUpperCase()}` : 'P-00000000'}
          period={currentDate}
          clinic="Centro de Rehabilitación Mou"
        />

        <ReportSummary />

        <ProgressSection />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ObservationsSection />
          <RecommendationsSection />
        </div>
      </main>

      {/* Desktop PDF button */}
      <div className="hidden md:block fixed bottom-6 right-6 z-30">
        <button
          onClick={handleExportPdf}
          className="flex items-center gap-2 bg-blue-600 text-white font-semibold px-5 py-3 rounded-xl shadow-lg hover:bg-blue-700 active:scale-[0.98] transition-all"
        >
          <Download size={18} />
          Exportar PDF
        </button>
      </div>
    </div>
  );
}
