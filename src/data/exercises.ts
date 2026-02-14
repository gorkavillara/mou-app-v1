export type ExerciseType = 'MP_IP_BLOCKED' | 'FINGERS_NO_IP_BLOCK' | 'WRIST';

export interface Exercise {
  id: ExerciseType;
  name: string;
  description: string;
  videoUrl?: string;
}

export const EXERCISES: Exercise[] = [
  {
    id: 'MP_IP_BLOCKED',
    name: 'FE activa MP con IP bloqueadas',
    description: 'Flexoextensión activa metacarpofalángica con interfalángicas bloqueadas. Mantén los dedos rectos mientras flexionas la base de los dedos.',
    videoUrl: 'assets/videos/fe-activa-mp-con-ip-bloqueadas.mp4',
  },
  {
    id: 'FINGERS_NO_IP_BLOCK',
    name: 'FE activa de dedos sin bloqueo de IP',
    description: 'Flexoextensión activa de dedos sin bloqueo de interfalángicas. Cierra el puño completamente y luego estira los dedos.',
    videoUrl: 'assets/videos/fe-activa-de-dedos-sin-bloqueo-de-ip.mp4',
  },
  {
    id: 'WRIST',
    name: 'FE activa de muñeca',
    description: 'Flexoextensión activa de muñeca. Mueve la mano hacia arriba y hacia abajo desde la muñeca.',
    videoUrl: 'assets/videos/fe-activa-de-muneca.mp4',
  },
];
