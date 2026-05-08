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

// --- Per-joint angle calculation (Fase 1, IA-02) ---
// See docs/obsidian-vault/12-Convencion-angular.md for the geometric convention.

export type JointName = 'wrist' | 'MCP' | 'PIP' | 'DIP';

export type JointAngles = {
  /** Metacarpophalangeal joint (base of finger). 0° = straight, ~90° = flexed to palm. */
  MCP: number;
  /** Proximal interphalangeal joint. 0° = straight, ~100° = full flexion. */
  PIP: number;
  /** Distal interphalangeal joint (fingertip). 0° = straight, ~80° = full flexion. */
  DIP: number;
};

export type FingerJointAngles = Record<FingerName, JointAngles>;

function angleBetweenVectors(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): number {
  const dot = ax * bx + ay * by + az * bz;
  const magA = Math.sqrt(ax * ax + ay * ay + az * az);
  const magB = Math.sqrt(bx * bx + by * by + bz * bz);
  if (magA === 0 || magB === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (magA * magB)));
  return Math.acos(cos) * (180 / Math.PI);
}

/**
 * Computes MCP, PIP and DIP angles for a single finger.
 *
 * - MCP: between wrist→MCP and MCP→PIP. Sign carries flexion (+) / hyperextension (−).
 * - PIP: between MCP→PIP and PIP→DIP. Always non-negative (PIP cannot hyperextend).
 * - DIP: between PIP→DIP and DIP→TIP.
 *
 * Returned values are RAW measured degrees. Apply `normalizeJointAngle` to map
 * them to the clinical 0–90° (or 0–100/0–80) range.
 */
export function calculateJointAngles(landmarks: Point[], finger: FingerConfig): JointAngles {
  const wrist = landmarks[0];
  const mcp = landmarks[finger.mcpIndex];
  const pip = landmarks[finger.pipIndex];
  const dip = landmarks[finger.dipIndex];
  const tip = landmarks[finger.tipIndex];

  // MCP: wrist→MCP versus MCP→PIP. Preserve sign for hyperextension.
  const a1x = mcp.x - wrist.x, a1y = mcp.y - wrist.y, a1z = mcp.z - wrist.z;
  const b1x = pip.x - mcp.x,   b1y = pip.y - mcp.y,   b1z = pip.z - mcp.z;
  const mcpMag = angleBetweenVectors(a1x, a1y, a1z, b1x, b1y, b1z);
  const mcpCross2D = a1x * b1y - a1y * b1x;
  const mcpAngle = mcpCross2D >= 0 ? mcpMag : -mcpMag;

  // PIP: MCP→PIP versus PIP→DIP. Magnitude only.
  const a2x = pip.x - mcp.x,   a2y = pip.y - mcp.y,   a2z = pip.z - mcp.z;
  const b2x = dip.x - pip.x,   b2y = dip.y - pip.y,   b2z = dip.z - pip.z;
  const pipAngle = angleBetweenVectors(a2x, a2y, a2z, b2x, b2y, b2z);

  // DIP: PIP→DIP versus DIP→TIP. Magnitude only.
  const a3x = dip.x - pip.x,   a3y = dip.y - pip.y,   a3z = dip.z - pip.z;
  const b3x = tip.x - dip.x,   b3y = tip.y - dip.y,   b3z = tip.z - dip.z;
  const dipAngle = angleBetweenVectors(a3x, a3y, a3z, b3x, b3y, b3z);

  return { MCP: mcpAngle, PIP: pipAngle, DIP: dipAngle };
}

export function calculateAllJointAngles(landmarks: Point[]): FingerJointAngles {
  const out = {} as FingerJointAngles;
  for (const finger of FINGERS) {
    out[finger.name] = calculateJointAngles(landmarks, finger);
  }
  return out;
}

/**
 * Wrist flexion/extension angle.
 *
 * @param landmarks    The 21 hand landmarks from MediaPipe.
 * @param forearmPoint Optional virtual forearm reference projected from the wrist
 *                     opposite to the hand. If omitted, uses wrist→middleMCP as
 *                     the only reference vector (less reliable; prefer providing it).
 *                     Positive = palmar flexion, negative = dorsal extension.
 */
export function calculateWristAngle(landmarks: Point[], forearmPoint?: Point): number {
  const wrist = landmarks[0];
  const middleMCP = landmarks[9];

  if (!forearmPoint) {
    return 0;
  }

  const ax = wrist.x - forearmPoint.x;
  const ay = wrist.y - forearmPoint.y;
  const az = wrist.z - forearmPoint.z;
  const bx = middleMCP.x - wrist.x;
  const by = middleMCP.y - wrist.y;
  const bz = middleMCP.z - wrist.z;

  const mag = angleBetweenVectors(ax, ay, az, bx, by, bz);
  const cross2D = ax * by - ay * bx;
  return cross2D >= 0 ? mag : -mag;
}

// --- Calibration & normalization (IA-03) ---
// Maps raw measured degrees to the clinical 0–X° range.
// IMPORTANT: the `measured*` values are placeholders pending validation
// with Javi + goniometer (see docs/obsidian-vault/12-Convencion-angular.md).

export type JointCalibration = {
  measuredOpen: number;
  measuredClosed: number;
  clinicalMax: number;
  /** Negative bound for joints that hyperextend (wrist, MCP). */
  clinicalMin?: number;
};

export const JOINT_CALIBRATION: Record<JointName, JointCalibration> = {
  wrist: { measuredOpen: 15, measuredClosed: 95,  clinicalMax: 90, clinicalMin: -70 },
  MCP:   { measuredOpen: 12, measuredClosed: 100, clinicalMax: 90, clinicalMin: -30 },
  PIP:   { measuredOpen: 10, measuredClosed: 110, clinicalMax: 100 },
  DIP:   { measuredOpen: 8,  measuredClosed: 95,  clinicalMax: 80 },
};

/**
 * Linearly maps a raw measured angle to the clinical range using the joint's
 * calibration. Values outside the measured envelope are clamped.
 *
 * For joints with `clinicalMin` (hyperextension capable), negative inputs are
 * mapped to the negative side of the clinical range with a separate slope so
 * that 0° always sits at the neutral position.
 */
export function normalizeJointAngle(measuredDeg: number, joint: JointName): number {
  const cal = JOINT_CALIBRATION[joint];
  if (measuredDeg >= 0) {
    const range = cal.measuredClosed - cal.measuredOpen;
    if (range <= 0) return 0;
    const clamped = Math.max(cal.measuredOpen, Math.min(cal.measuredClosed, measuredDeg));
    return ((clamped - cal.measuredOpen) / range) * cal.clinicalMax;
  }
  const minClinical = cal.clinicalMin ?? 0;
  if (minClinical === 0) return 0;
  const clamped = Math.max(-cal.measuredOpen, measuredDeg);
  return (clamped / cal.measuredOpen) * Math.abs(minClinical);
}

export function normalizeFingerJointAngles(raw: JointAngles): JointAngles {
  return {
    MCP: normalizeJointAngle(raw.MCP, 'MCP'),
    PIP: normalizeJointAngle(raw.PIP, 'PIP'),
    DIP: normalizeJointAngle(raw.DIP, 'DIP'),
  };
}

// --- Legacy aliases retained for in-flight callers (to be removed once
// /exercises is rewired against the new API). ---

export type ROMAngles = {
  mcp: number;
  ifProximal: number;
  ifDistal: number;
};

/** @deprecated use `calculateJointAngles(...).MCP` */
export function calculateMCPAngle(landmarks: Point[], finger: FingerConfig): number {
  return calculateJointAngles(landmarks, finger).MCP;
}

/** @deprecated use `calculateJointAngles` */
export function calculateIFAngle(landmarks: Point[], finger: FingerConfig): ROMAngles {
  const j = calculateJointAngles(landmarks, finger);
  return { mcp: j.MCP, ifProximal: j.PIP, ifDistal: j.DIP };
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
