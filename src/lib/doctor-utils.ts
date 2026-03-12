import type { CohortPatient, Alert, DeviationData } from './doctor-types';
import { patients } from '@/data/patients';

const ROM_THRESHOLD_CRITICAL = 40;
const ROM_THRESHOLD_WARNING = 60;
const ADHERENCE_THRESHOLD = 0.5;

export function getCohortPatients(): CohortPatient[] {
  return patients.map(p => {
    const romAvg = Math.round(p.ifrm * 0.8 + Math.random() * 15);
    const status = calculatePatientStatus(p.adherence, romAvg);
    
    return {
      id: p.id,
      name: p.name,
      diagnosis: p.diagnosis,
      lastSession: p.lastSession,
      adherence: p.adherence,
      ifrm: p.ifrm,
      romAvg,
      status
    };
  });
}

function calculatePatientStatus(adherence: number, romAvg: number): 'active' | 'warning' | 'critical' {
  if (adherence < ADHERENCE_THRESHOLD || romAvg < ROM_THRESHOLD_CRITICAL) {
    return 'critical';
  }
  if (adherence < 0.7 || romAvg < ROM_THRESHOLD_WARNING) {
    return 'warning';
  }
  return 'active';
}

export function generateAlerts(patientList: CohortPatient[]): Alert[] {
  const alerts: Alert[] = [];
  let alertId = 1;

  patientList.forEach(patient => {
    if (patient.romAvg < ROM_THRESHOLD_CRITICAL) {
      alerts.push({
        id: `alert-${alertId++}`,
        patientId: patient.id,
        patientName: patient.name,
        type: 'ROM_INSUFICIENTE',
        severity: 'CRITICAL',
        message: `ROM promedio ${patient.romAvg}° por debajo del umbral crítico (${ROM_THRESHOLD_CRITICAL}°)`,
        createdAt: new Date()
      });
    } else if (patient.romAvg < ROM_THRESHOLD_WARNING) {
      alerts.push({
        id: `alert-${alertId++}`,
        patientId: patient.id,
        patientName: patient.name,
        type: 'ROM_INSUFICIENTE',
        severity: 'WARNING',
        message: `ROM promedio ${patient.romAvg}° por debajo del objetivo (${ROM_THRESHOLD_WARNING}°)`,
        createdAt: new Date()
      });
    }

    if (patient.adherence < ADHERENCE_THRESHOLD) {
      alerts.push({
        id: `alert-${alertId++}`,
        patientId: patient.id,
        patientName: patient.name,
        type: 'BAJA_ADHERENCIA',
        severity: patient.adherence < 0.3 ? 'CRITICAL' : 'WARNING',
        message: `Adherencia del ${Math.round(patient.adherence * 100)}% por debajo del umbral`,
        createdAt: new Date()
      });
    }
  });

  return alerts.sort((a, b) => {
    const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

export function getDeviationData(patientId?: string): DeviationData[] {
  const patientList = getCohortPatients();
  const targetPatient = patientId 
    ? patientList.find(p => p.id === patientId) 
    : patientList[0];

  if (!targetPatient) return [];

  const data: DeviationData[] = [];
  let currentRom = 30;

  for (let day = 1; day <= 50; day += 5) {
    currentRom = Math.min(targetPatient.romAvg, currentRom + 8 + Math.random() * 4);
    const objetivo = Math.min(90, 40 + day);
    const desviacion = currentRom - objetivo;

    data.push({
      day,
      paciente: Math.round(currentRom),
      objetivo,
      desviacion: Math.round(desviacion)
    });
  }

  return data;
}

export function getGlobalDeviationData(): DeviationData[] {
  const data: DeviationData[] = [];
  let currentRom = 45;

  for (let day = 1; day <= 50; day += 5) {
    currentRom = Math.min(80, currentRom + 6 + Math.random() * 3);
    const objetivo = Math.min(90, 40 + day);
    const desviacion = currentRom - objetivo;

    data.push({
      day,
      paciente: Math.round(currentRom),
      objetivo,
      desviacion: Math.round(desviacion)
    });
  }

  return data;
}
