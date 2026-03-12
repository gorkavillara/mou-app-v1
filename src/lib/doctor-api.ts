import { mockCohortData } from '@/data/mock-cohort';

export interface MutuaPatientResponse {
  id: string;
  nombre: string;
  diagnostico: string;
  ultimaFechaSesion: string;
  metrics: {
    ifrm: number;
    adherencia: number;
    romPromedio: number;
    estado: 'active' | 'warning' | 'critical';
  };
}

export interface MutuaProgressResponse {
  patientId: string;
  nombre: string;
  diagnostico: string;
  historialSesiones: {
    fecha: string;
    maxFlexion: number;
    duracionMinutos: number;
  }[];
  romPromedio: number;
  adherencia: number;
  desviacionObjetivo: number;
  diasRehabilitacion: number;
  prediccionRecuperacion?: number;
}

export function getMutuaPatients(): MutuaPatientResponse[] {
  return mockCohortData.map(p => ({
    id: p.id,
    nombre: p.name,
    diagnostico: p.diagnosis,
    ultimaFechaSesion: p.lastSession,
    metrics: {
      ifrm: p.ifrm,
      adherencia: Math.round(p.adherence * 100),
      romPromedio: p.romAvg,
      estado: p.status
    }
  }));
}

export function getMutuaPatientProgress(patientId: string): MutuaProgressResponse | null {
  const patient = mockCohortData.find(p => p.id === patientId);
  if (!patient) return null;

  const historial = generateMockSessionHistory(patientId);
  const romPromedio = historial.reduce((sum, s) => sum + s.maxFlexion, 0) / historial.length;
  const adherence = patient.adherence;
  const diasRehabilitacion = Math.floor(Math.random() * 30) + 10;
  const objetivoDia50 = 90;
  const desviacion = romPromedio - objetivoDia50;

  return {
    patientId: patient.id,
    nombre: patient.name,
    diagnostico: patient.diagnosis,
    historialSesiones: historial,
    romPromedio: Math.round(romPromedio),
    adherencia: Math.round(adherence * 100),
    desviacionObjetivo: Math.round(desviacion),
    diasRehabilitacion,
    prediccionRecuperacion: diasRehabilitacion + Math.ceil((90 - romPromedio) / 3)
  };
}

function generateMockSessionHistory(patientId: string): { fecha: string; maxFlexion: number; duracionMinutos: number }[] {
  const sessions = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 30);

  const patient = mockCohortData.find(p => p.id === patientId);
  const baseRom = patient?.romAvg || 60;

  for (let i = 0; i < 12; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i * 2.5);
    
    sessions.push({
      fecha: date.toISOString().split('T')[0],
      maxFlexion: Math.round(baseRom - 10 + Math.random() * 20 + (i * 2)),
      duracionMinutos: Math.round(15 + Math.random() * 20)
    });
  }

  return sessions;
}

export function validateApiKey(headers: Headers): boolean {
  const apiKey = headers.get('x-api-key');
  return apiKey === 'mock-mutua-key-2025' || apiKey === 'dev-key';
}
