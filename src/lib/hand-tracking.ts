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

// --- Per-finger angle calculation ---

/**
 * Measures the MCP joint angle in 3D space.
 * v1: metacarpal direction (wrist→MCP)
 * v2: proximal phalanx direction (MCP→PIP)
 * At full extension the vectors are collinear → 0°.
 * Flexion produces a positive angle; hyperextension a negative one.
 */
export function calculateFingerAngle(landmarks: Point[], finger: FingerConfig): number {
  const wrist = landmarks[0];
  const mcp = landmarks[finger.mcpIndex];
  const pip = landmarks[finger.pipIndex];

  const v1 = { x: mcp.x - wrist.x, y: mcp.y - wrist.y, z: mcp.z - wrist.z };
  const v2 = { x: pip.x - mcp.x, y: pip.y - mcp.y, z: pip.z - mcp.z };

  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);

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
 * Returns the representative exercise angle based on the active fingers.
 * Injured fingers are prioritised; falls back to the average of all fingers.
 */
export function getExerciseAngle(
  landmarks: Point[],
  fingerStatus: FingerStatusMap,
): number {
  const fingerAngles = calculateAllFingerAngles(landmarks);
  const injuredFingers = FINGERS.filter(f => fingerStatus[f.name] === 'injured');
  const targetFingers = injuredFingers.length > 0 ? injuredFingers : FINGERS;
  const sum = targetFingers.reduce((acc, f) => acc + fingerAngles[f.name], 0);
  return sum / targetFingers.length;
}

// --- Finger connections for drawing ---

export const FINGER_CONNECTIONS: Record<FingerName, [number, number][]> = {
  pulgar:  [[0, 1],  [1, 2],   [2, 3],   [3, 4]],
  indice:  [[0, 5],  [5, 6],   [6, 7],   [7, 8]],
  medio:   [[0, 9],  [9, 10],  [10, 11], [11, 12]],
  anular:  [[0, 13], [13, 14], [14, 15], [15, 16]],
  menique: [[0, 17], [17, 18], [18, 19], [19, 20]],
};

export const PALM_CONNECTIONS: [number, number][] = [
  [5, 9], [9, 13], [13, 17],
];

// --- Drawing utilities ---

const FINGER_LINE_COLOR: Record<FingerStatus, string> = {
  normal:   '#22D3EE', // cyan-400
  injured:  '#FB923C', // orange-400
  amputated: '#6B7280', // gray-500
};

const POINT_COLOR: Record<FingerStatus, string> = {
  normal:   '#67E8F9', // cyan-300 – slightly brighter for dots
  injured:  '#FDBA74', // orange-300
  amputated: '#9CA3AF', // gray-400
};

/**
 * Maps a MediaPipe normalised landmark to canvas pixel coordinates,
 * accounting for the `object-fit: cover` scaling applied to the video element.
 */
function toCanvas(
  lm: { x: number; y: number },
  videoW: number,
  videoH: number,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  const scale = Math.max(canvasW / videoW, canvasH / videoH);
  const offsetX = (canvasW - videoW * scale) / 2;
  const offsetY = (canvasH - videoH * scale) / 2;
  return {
    x: lm.x * videoW * scale + offsetX,
    y: lm.y * videoH * scale + offsetY,
  };
}

/**
 * Draws the hand skeleton on the given canvas context.
 *
 * @param videoWidth  Native width of the video stream (for cover-remap).
 * @param videoHeight Native height of the video stream (for cover-remap).
 */
export function drawHand(
  ctx: CanvasRenderingContext2D,
  landmarks: Point[],
  canvasWidth: number,
  canvasHeight: number,
  videoWidth: number,
  videoHeight: number,
  fingerStatus: FingerStatusMap,
  fingerAngles: FingerAngles,
) {
  const px = (lm: Point) =>
    toCanvas(lm, videoWidth, videoHeight, canvasWidth, canvasHeight);

  // Palm connections – subtle sky line
  ctx.strokeStyle = '#0EA5E9';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  PALM_CONNECTIONS.forEach(([a, b]) => {
    const start = px(landmarks[a]);
    const end   = px(landmarks[b]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  });

  // Finger connections
  const fingerNames = Object.keys(FINGER_CONNECTIONS) as FingerName[];
  for (const name of fingerNames) {
    const status = fingerStatus[name];
    const color  = FINGER_LINE_COLOR[status];

    ctx.strokeStyle = color;
    ctx.lineWidth = status === 'injured' ? 2 : 1.5;

    if (status === 'amputated') {
      ctx.setLineDash([4, 4]);
    } else {
      ctx.setLineDash([]);
    }

    FINGER_CONNECTIONS[name].forEach(([a, b]) => {
      const start = px(landmarks[a]);
      const end   = px(landmarks[b]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    });

    ctx.setLineDash([]);
  }

  // Landmark dots – determine color per finger; wrist dot is neutral
  const landmarkFingerMap: Record<number, FingerName> = {};
  for (const finger of FINGERS) {
    for (const idx of [finger.mcpIndex, finger.pipIndex, finger.dipIndex, finger.tipIndex]) {
      landmarkFingerMap[idx] = finger.name;
    }
  }

  landmarks.forEach((lm, index) => {
    const { x, y } = px(lm);
    const fingerName = landmarkFingerMap[index];
    const status: FingerStatus = fingerName ? fingerStatus[fingerName] : 'normal';
    const fillColor = POINT_COLOR[status];
    const isTip = [4, 8, 12, 16, 20].includes(index);
    const radius = isTip ? 4 : 3;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Angle labels above injured finger tips
  // The canvas has CSS scaleX(-1), so we counter-flip text rendering.
  for (const finger of FINGERS) {
    if (fingerStatus[finger.name] !== 'injured') continue;

    const tip = landmarks[finger.tipIndex];
    const { x, y } = px(tip);
    const angle = Math.round(Math.abs(fingerAngles[finger.name]));
    const label = `${angle}°`;

    ctx.save();
    ctx.translate(x, y - 20);
    ctx.scale(-1, 1);

    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(-tw / 2, -9, tw, 18, 4);
    ctx.fill();

    ctx.fillStyle = '#FB923C';
    ctx.fillText(label, 0, 0);

    ctx.restore();
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

// --- Enhanced ROM: MCP and IF angles ---

export type ROMAngles = {
  mcp: number;
  ifProximal: number;
  ifDistal: number;
};

export function calculateMCPAngle(landmarks: Point[], finger: FingerConfig): number {
  const wrist = landmarks[0];
  const mcp = landmarks[finger.mcpIndex];
  const pip = landmarks[finger.pipIndex];

  const v1 = { x: mcp.x - wrist.x, y: mcp.y - wrist.y, z: mcp.z - wrist.z };
  const v2 = { x: pip.x - mcp.x, y: pip.y - mcp.y, z: pip.z - mcp.z };

  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  const angle = Math.acos(cosAngle) * (180 / Math.PI);

  const cross = v1.x * v2.y - v1.y * v2.x;
  return cross > 0 ? angle : -angle;
}

export function calculateIFAngle(landmarks: Point[], finger: FingerConfig): ROMAngles {
  const mcp = landmarks[finger.mcpIndex];
  const pip = landmarks[finger.pipIndex];
  const dip = landmarks[finger.dipIndex];
  const tip = landmarks[finger.tipIndex];

  const v1 = { x: pip.x - mcp.x, y: pip.y - mcp.y, z: pip.z - mcp.z };
  const v2 = { x: dip.x - pip.x, y: dip.y - pip.y, z: dip.z - pip.z };
  const dot1 = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1_ = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
  const mag2_ = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);

  let ifProximal = 0;
  if (mag1_ > 0 && mag2_ > 0) {
    const cosAngle1 = Math.max(-1, Math.min(1, dot1 / (mag1_ * mag2_)));
    ifProximal = Math.acos(cosAngle1) * (180 / Math.PI);
  }

  const v3 = { x: dip.x - pip.x, y: dip.y - pip.y, z: dip.z - pip.z };
  const v4 = { x: tip.x - dip.x, y: tip.y - dip.y, z: tip.z - dip.z };
  const dot2 = v3.x * v4.x + v3.y * v4.y + v3.z * v4.z;
  const mag3 = Math.sqrt(v3.x ** 2 + v3.y ** 2 + v3.z ** 2);
  const mag4 = Math.sqrt(v4.x ** 2 + v4.y ** 2 + v4.z ** 2);

  let ifDistal = 0;
  if (mag3 > 0 && mag4 > 0) {
    const cosAngle2 = Math.max(-1, Math.min(1, dot2 / (mag3 * mag4)));
    ifDistal = Math.acos(cosAngle2) * (180 / Math.PI);
  }

  return {
    mcp: calculateMCPAngle(landmarks, finger),
    ifProximal,
    ifDistal,
  };
}

// --- Hand Signature for Identity Validation ---

export type HandSignatureMetadata = {
  avgFingerLength: number;
  palmWidth: number;
  handRatio: number;
};

export type HandSignature = {
  landmarks: Point[];
  metadata: HandSignatureMetadata;
  createdAt: number;
};

function calculateDistance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2);
}

export function createHandSignature(landmarks: Point[]): HandSignature {
  const wrist = landmarks[0];
  
  const fingerTips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
  const fingerBases = [landmarks[1], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
  
  let totalFingerLength = 0;
  for (let i = 0; i < 5; i++) {
    totalFingerLength += calculateDistance(fingerTips[i], fingerBases[i]);
  }
  const avgFingerLength = totalFingerLength / 5;

  const palmWidth = calculateDistance(landmarks[5], landmarks[17]);
  const handLength = calculateDistance(wrist, landmarks[12]);

  return {
    landmarks,
    metadata: {
      avgFingerLength,
      palmWidth,
      handRatio: handLength > 0 ? palmWidth / handLength : 0,
    },
    createdAt: Date.now(),
  };
}

function normalizePoint(p: Point, ref: Point): Point {
  return { x: p.x - ref.x, y: p.y - ref.y, z: p.z - ref.z };
}

function calculateSimilarityMetric(sig1: HandSignature, normalized2: Point[]): number {
  if (sig1.landmarks.length !== normalized2.length) return 0;

  let totalDiff = 0;
  const numPoints = sig1.landmarks.length;
  
  for (let i = 0; i < numPoints; i++) {
    const diff = Math.sqrt(
      (sig1.landmarks[i].x - normalized2[i].x) ** 2 +
      (sig1.landmarks[i].y - normalized2[i].y) ** 2 +
      (sig1.landmarks[i].z - normalized2[i].z) ** 2
    );
    totalDiff += diff;
  }

  const avgDiff = totalDiff / numPoints;
  const maxPossibleDiff = 2.0;
  const similarity = Math.max(0, 100 - (avgDiff / maxPossibleDiff) * 100);
  
  return Math.min(100, similarity + (100 - Math.abs(sig1.metadata.handRatio - 
    (calculateDistance(normalized2[5], normalized2[17]) / 
     (calculateDistance(normalized2[0], normalized2[12]) || 1))) * 20));
}

export function compareHandSignature(
  stored: HandSignature,
  capturedLandmarks: Point[]
): number {
  const refPoint = stored.landmarks[0];
  const capturedRef = capturedLandmarks[0];
  
  const normalizedStored = stored.landmarks.map(lm => normalizePoint(lm, refPoint));
  const normalizedCaptured = capturedLandmarks.map(lm => normalizePoint(lm, capturedRef));
  
  return calculateSimilarityMetric(
    { ...stored, landmarks: normalizedStored },
    normalizedCaptured
  );
}
