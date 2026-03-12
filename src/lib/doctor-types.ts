export interface CohortPatient {
  id: string;
  name: string;
  diagnosis: string;
  lastSession: string;
  adherence: number;
  ifrm: number;
  romAvg: number;
  status: 'active' | 'warning' | 'critical';
}

export interface Alert {
  id: string;
  patientId: string;
  patientName: string;
  type: 'ROM_INSUFICIENTE' | 'BAJA_ADHERENCIA' | 'SIN_SESIONES';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  createdAt: Date;
}

export interface DeviationData {
  day: number;
  paciente: number;
  objetivo: number;
  desviacion: number;
}

export interface SessionData {
  id: string;
  patientId: string;
  startedAt: string;
  maxFlexion: number | null;
  progress: number | null;
}
