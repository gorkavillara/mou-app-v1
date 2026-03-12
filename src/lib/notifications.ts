import type { Patient } from '@/data/patients';

export type ExerciseSchedule = {
  times: string[];
  days: number[];
};

export type LowBackSchedule = {
  startDate: string;
  endDate: string;
};

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function isPatientOnLowBack(patient: Patient): boolean {
  const lowBack = (patient as ExtendedPatient).lowBackSchedule;
  if (!lowBack) return false;

  const now = new Date();
  const start = new Date(lowBack.startDate);
  const end = new Date(lowBack.endDate);

  return now >= start && now <= end;
}

export function isWithinExerciseTime(patient: Patient): boolean {
  const schedule = (patient as ExtendedPatient).exerciseSchedule;
  if (!schedule || !schedule.times || schedule.times.length === 0) {
    return false;
  }

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const currentDay = now.getDay();

  if (!schedule.days.includes(currentDay)) {
    return false;
  }

  return schedule.times.includes(currentTime);
}

export function showNotification(title: string, body: string, onClick?: () => void): void {
  if (Notification.permission !== 'granted') {
    return;
  }

  const notification = new Notification(title, {
    body,
    icon: '/icon.png',
    badge: '/badge.png',
  });

  if (onClick) {
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  }
}

export function checkAndNotify(
  patient: Patient,
  onNotify: (message: string, type: 'info' | 'warning' | 'lowback') => void
): void {
  if (isPatientOnLowBack(patient)) {
    onNotify('Estás en período de baja laboral - Ejercicios pausados', 'lowback');
    return;
  }

  if (isWithinExerciseTime(patient)) {
    onNotify('Es hora de tu sesión de rehabilitación', 'info');
  }
}

export function getLowBackEndMessage(patient: Patient): string | null {
  const lowBack = (patient as ExtendedPatient).lowBackSchedule;
  if (!lowBack) return null;

  const now = new Date();
  const end = new Date(lowBack.endDate);

  if (now > end) {
    return 'Tu período de baja ha terminado. ¡Reanuda tu rehabilitación!';
  }

  return null;
}

type ExtendedPatient = Patient & {
  exerciseSchedule?: ExerciseSchedule;
  lowBackSchedule?: LowBackSchedule;
};
