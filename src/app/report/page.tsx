'use client';

import React from 'react';
import { ChevronLeft, Download } from 'lucide-react';
import { PatientHeader } from '@/components/report/PatientHeader';
import { ReportSummary } from '@/components/report/ReportSummary';
import { ProgressSection } from '@/components/report/ProgressSection';
import { ObservationsSection } from '@/components/report/ObservationsSection';
import { RecommendationsSection } from '@/components/report/RecommendationsSection';
import { AppNav } from '@/components/AppNav';
import { jsPDF } from 'jspdf';

export default function Report() {
  const handleExportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Informe de Rehabilitación', 20, 20);
    doc.setFontSize(11);
    doc.text('Paciente: Carlos Mendoza', 20, 35);
    doc.text('ID: P-2024-1847', 20, 42);
    doc.text('Período: 1-31 Enero 2025', 20, 49);
    doc.text('Centro: Centro de Rehabilitación San José', 20, 56);
    doc.setFontSize(13);
    doc.text('Resumen', 20, 72);
    doc.setFontSize(11);
    doc.text('- IFRM: 78/100 (↑ 2.4% vs semana anterior)', 20, 82);
    doc.text('- Adherencia: 5/7 sesiones, 180 de 210 min', 20, 90);
    doc.text('- Calidad de ejecución: estable', 20, 98);
    doc.text('Observaciones', 20, 114);
    doc.text('- Buena respuesta en ejercicios de pinza y extensión', 20, 122);
    doc.text('Recomendaciones', 20, 138);
    doc.text('- Mantener rutina y añadir "Pinza con Esponja"', 20, 146);
    doc.save('informe_mou.pdf');
  };

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
          name="Carlos Mendoza"
          id="P-2024-1847"
          period="1-31 Enero 2025"
          clinic="Centro de Rehabilitación San José"
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
