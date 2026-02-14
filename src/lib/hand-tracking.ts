export type Point = { x: number; y: number; z: number };

export type FingerName = 'pulgar' | 'indice' | 'medio' | 'anular' | 'menique';

export type FingerConfig = {
  name: FingerName;
  label: string;
  mcpIndex: number;
  pipIndex: number;
  dipIndex: number;
  tipIndex: number;
};

export const FINGERS: FingerConfig[] = [
  { name: 'pulgar', label: 'Pulgar', mcpIndex: 1, pipIndex: 2, dipIndex: 3, tipIndex: 4 },
  { name: 'indice', label: 'Índice', mcpIndex: 5, pipIndex: 6, dipIndex: 7, tipIndex: 8 },
  { name: 'medio', label: 'Medio', mcpIndex: 9, pipIndex: 10, dipIndex: 11, tipIndex: 12 },
  { name: 'anular', label: 'Anular', mcpIndex: 13, pipIndex: 14, dipIndex: 15, tipIndex: 16 },
  { name: 'menique', label: 'Meñique', mcpIndex: 17, pipIndex: 18, dipIndex: 19, tipIndex: 20 },
];

export type FingerStatus = 'normal' | 'injured' | 'amputated';
export type FingerStatusMap = Record<FingerName, FingerStatus>;

export const DEFAULT_FINGER_STATUS: FingerStatusMap = {
  pulgar: 'normal',
  indice: 'normal',
  medio: 'normal',
  anular: 'normal',
  menique: 'normal',
};

export type FingerAngles = Record<FingerName, number>;

export type RepData = {
  repNumber: number;
  maxFlexion: number;
  maxExtension: number;
};

// --- Forearm reference point ---

export function calculateForearmPoint(landmarks: Point[], referenceVector?: Point): Point {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  // Factor increased to move the point further back on the forearm (almost elbow)
  const factor = 1.2;

  // Use reference vector if provided (calibration), otherwise default to current hand orientation
  const v = referenceVector || {
    x: wrist.x - middleMcp.x,
    y: wrist.y - middleMcp.y,
    z: wrist.z - middleMcp.z,
  };

  return {
    x: wrist.x + v.x * factor,
    y: wrist.y + v.y * factor,
    z: wrist.z + v.z * factor,
  };
}

// --- Wrist angle using forearm reference ---

export function calculateWristAngle(landmarks: Point[], referenceVector?: Point): number {
  const wrist = landmarks[0];
  const forearm = calculateForearmPoint(landmarks, referenceVector);
  const middleMcp = landmarks[9];

  const v1 = { x: wrist.x - forearm.x, y: wrist.y - forearm.y };
  const v2 = { x: middleMcp.x - wrist.x, y: middleMcp.y - wrist.y };

  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  const angle = Math.acos(cosAngle) * (180 / Math.PI);

  const cross = v1.x * v2.y - v1.y * v2.x;
  return cross > 0 ? angle : -angle;
}

// --- Per-finger angle calculation ---

export function calculateFingerAngle(landmarks: Point[], finger: FingerConfig): number {
  const wrist = landmarks[0];
  const mcp = landmarks[finger.mcpIndex];
  const tip = landmarks[finger.tipIndex];

  const v1 = { x: mcp.x - wrist.x, y: mcp.y - wrist.y };
  const v2 = { x: tip.x - mcp.x, y: tip.y - mcp.y };

  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  const angle = Math.acos(cosAngle) * (180 / Math.PI);

  const cross = v1.x * v2.y - v1.y * v2.x;
  return cross > 0 ? angle : -angle;
}

export function calculateAllFingerAngles(landmarks: Point[]): FingerAngles {
  const angles = {} as FingerAngles;
  for (const finger of FINGERS) {
    angles[finger.name] = calculateFingerAngle(landmarks, finger);
  }
  return angles;
}

/**
 * Calculates a representative angle based on the exercise type and finger status.
 */
export function getExerciseAngle(
  landmarks: Point[],
  exerciseId: string,
  fingerStatus: FingerStatusMap,
  forearmReferenceVector?: Point
): number {
  if (exerciseId === 'WRIST') {
    return calculateWristAngle(landmarks, forearmReferenceVector);
  }

  // For finger exercises, we track the average angle of injured fingers.
  // If no fingers are marked as injured, we take the average of all fingers.
  const fingerAngles = calculateAllFingerAngles(landmarks);
  const injuredFingers = FINGERS.filter(f => fingerStatus[f.name] === 'injured');

  const targetFingers = injuredFingers.length > 0 ? injuredFingers : FINGERS;

  const sum = targetFingers.reduce((acc, f) => acc + fingerAngles[f.name], 0);
  return sum / targetFingers.length;
}

// --- Finger connections for drawing ---

export const FINGER_CONNECTIONS: Record<FingerName, [number, number][]> = {
  pulgar: [[0, 1], [1, 2], [2, 3], [3, 4]],
  indice: [[0, 5], [5, 6], [6, 7], [7, 8]],
  medio: [[0, 9], [9, 10], [10, 11], [11, 12]],
  anular: [[0, 13], [13, 14], [14, 15], [15, 16]],
  menique: [[0, 17], [17, 18], [18, 19], [19, 20]],
};

export const PALM_CONNECTIONS: [number, number][] = [
  [5, 9], [9, 13], [13, 17],
];

// --- Drawing utilities ---

const FINGER_COLORS: Record<FingerStatus, string> = {
  normal: '#3B82F6',
  injured: '#F97316',
  amputated: '#6B7280',
};

export function drawHand(
  ctx: CanvasRenderingContext2D,
  landmarks: Point[],
  width: number,
  height: number,
  fingerStatus: FingerStatusMap,
  fingerAngles: FingerAngles,
  forearmReferenceVector?: Point
) {
  // Draw forearm line
  const forearm = calculateForearmPoint(landmarks, forearmReferenceVector);
  const wrist = landmarks[0];
  ctx.beginPath();
  ctx.setLineDash([8, 4]);
  ctx.strokeStyle = '#A78BFA';
  ctx.lineWidth = 3;
  ctx.moveTo(forearm.x * width, forearm.y * height);
  ctx.lineTo(wrist.x * width, wrist.y * height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw forearm point
  ctx.beginPath();
  ctx.arc(forearm.x * width, forearm.y * height, 7, 0, 2 * Math.PI);
  ctx.fillStyle = '#A78BFA';
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw palm connections
  ctx.strokeStyle = '#3B82F6';
  ctx.lineWidth = 3;
  PALM_CONNECTIONS.forEach(([start, end]) => {
    ctx.beginPath();
    ctx.moveTo(landmarks[start].x * width, landmarks[start].y * height);
    ctx.lineTo(landmarks[end].x * width, landmarks[end].y * height);
    ctx.stroke();
  });

  // Draw each finger with its status color
  const fingerNames = Object.keys(FINGER_CONNECTIONS) as FingerName[];
  for (const name of fingerNames) {
    const status = fingerStatus[name];
    const connections = FINGER_CONNECTIONS[name];
    const color = FINGER_COLORS[status];

    ctx.strokeStyle = color;
    ctx.lineWidth = status === 'injured' ? 4 : 3;

    if (status === 'amputated') {
      ctx.setLineDash([4, 4]);
    }

    connections.forEach(([start, end]) => {
      ctx.beginPath();
      ctx.moveTo(landmarks[start].x * width, landmarks[start].y * height);
      ctx.lineTo(landmarks[end].x * width, landmarks[end].y * height);
      ctx.stroke();
    });

    ctx.setLineDash([]);
  }

  // Draw landmark points
  landmarks.forEach((lm, index) => {
    const x = lm.x * width;
    const y = lm.y * height;
    ctx.beginPath();
    ctx.arc(x, y, index === 0 ? 8 : 5, 0, 2 * Math.PI);
    ctx.fillStyle = index === 0 ? '#10B981' : '#60A5FA';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Draw FE range labels above injured/tracked fingers
  for (const finger of FINGERS) {
    if (fingerStatus[finger.name] !== 'injured') continue;

    const tip = landmarks[finger.tipIndex];
    const angle = Math.round(Math.abs(fingerAngles[finger.name]));
    const label = `${angle}°`;

    const x = tip.x * width;
    const y = tip.y * height - 18;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const textWidth = ctx.measureText(label).width + 10;
    ctx.beginPath();
    ctx.roundRect(x - textWidth / 2, y - 10, textWidth, 20, 4);
    ctx.fill();

    ctx.fillStyle = '#F97316';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  }
}

// --- Repetition counting ---

export type RepCounter = {
  angleHistory: number[];
  lastDirection: 'up' | 'down' | null;
  repCount: number;
  currentRepMaxFlex: number;
  currentRepMaxExt: number;
  repHistory: RepData[];
};

export function createRepCounter(): RepCounter {
  return {
    angleHistory: [],
    lastDirection: null,
    repCount: 0,
    currentRepMaxFlex: 0,
    currentRepMaxExt: 0,
    repHistory: [],
  };
}

export function updateRepCounter(counter: RepCounter, angle: number): RepCounter {
  const next = { ...counter };
  next.angleHistory = [...counter.angleHistory, angle];
  if (next.angleHistory.length > 10) {
    next.angleHistory = next.angleHistory.slice(-10);
  }

  // Track per-rep extremes
  if (angle > 0) {
    next.currentRepMaxFlex = Math.max(next.currentRepMaxFlex, Math.round(angle));
  } else {
    next.currentRepMaxExt = Math.max(next.currentRepMaxExt, Math.round(Math.abs(angle)));
  }

  if (next.angleHistory.length < 5) return next;

  const avg = next.angleHistory.reduce((a, b) => a + b, 0) / next.angleHistory.length;
  const threshold = 15;

  if (avg > threshold && counter.lastDirection !== 'up') {
    if (counter.lastDirection === 'down') {
      next.repCount = counter.repCount + 1;
      next.repHistory = [
        ...counter.repHistory,
        {
          repNumber: next.repCount,
          maxFlexion: next.currentRepMaxFlex,
          maxExtension: next.currentRepMaxExt,
        },
      ];
      next.currentRepMaxFlex = 0;
      next.currentRepMaxExt = 0;
    }
    next.lastDirection = 'up';
  } else if (avg < -threshold && counter.lastDirection !== 'down') {
    next.lastDirection = 'down';
  }

  return next;
}
