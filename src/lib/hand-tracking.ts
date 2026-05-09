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

// --- Frame quality + rep counter (IA-05, IA-06) ---
//
// The legacy `createRepCounter` / `updateRepCounter` API above operates on a
// single bipolar "finger angle" (positive flexion / negative extension) in raw
// degrees. Fase 1 moves to per-joint normalized degrees: 0° = straight, 90°
// (or 100°/80° depending on the joint) = full flexion, with optional negative
// values for hyperextension on wrist/MCP. Threshold ±15° on the legacy scale
// is meaningless on the new scale because raw and normalized degrees are not
// the same units.
//
// The new API below (`createJointRepCounter` / `updateJointRepCounter`) takes
// clinical degrees directly, uses two thresholds (enter / exit) for hysteresis
// and tracks per-joint peaks so we can store flexor data per rep.

/**
 * Quality signal for a single frame in the rep window.
 *
 * `detected` is the only mandatory field — everything else is optional because
 * MediaPipe sometimes omits handedness or per-landmark visibility scores.
 */
export type FrameQuality = {
  /** Any hand at all detected this frame. */
  detected: boolean;
  /** MediaPipe handedness label, when present. */
  handedness?: 'Left' | 'Right';
  /** Confidence of the handedness label, 0..1. */
  handednessScore?: number;
  /** Average of `landmark.visibility` across the 21 keypoints, 0..1. */
  visibilityScore?: number;
};

/** Rep-level quality classification; matches the DB enum on `rep_measurements`. */
export type RepQualityFlag = 'clean' | 'low_visibility' | 'low_confidence' | 'partial';

export type RepQualityBreakdown = {
  flag: RepQualityFlag;
  framesMissing: number;
  framesTotal: number;
};

// Heuristic constants. Centralised for visibility — tune these against real
// pilot recordings, not synthetic tests.
//
// VISIBILITY_FLOOR: per-frame threshold below which we treat the frame as
//   missing. MediaPipe's visibility is not always populated; when absent we
//   treat the frame as visible (we trust `detected`) so calibrations don't
//   drift on devices that don't report it.
// LOW_VIS_RATIO / PARTIAL_VIS_RATIO: rep-level missing-frame ratios. Anything
//   above PARTIAL is "the camera basically lost the hand" → unusable for ROM.
//   Between LOW_VIS and PARTIAL we keep the rep but the doctor should know not
//   to trust the peaks.
// LOW_CONFIDENCE_HANDEDNESS: average handedness score under which we flag the
//   rep — even with perfect visibility, MediaPipe occasionally swaps left/
//   right and that's a strong "untrustworthy" signal for ROM.
const VISIBILITY_FLOOR = 0.4;
const LOW_VIS_RATIO = 0.3;
const PARTIAL_VIS_RATIO = 0.5;
const LOW_CONFIDENCE_HANDEDNESS = 0.7;

/**
 * Classifies the per-frame quality history of a single rep into one of four
 * flags. Order matters: we report the worst applicable flag.
 *
 * Severity ladder (worst → best):
 *   partial         — camera basically lost the hand (>50% missing)
 *   low_visibility  — significant frames missing or out-of-floor (>30% missing)
 *   low_confidence  — handedness confidence too low on average
 *   clean           — none of the above
 */
export function classifyRepQuality(
  perFrameQuality: FrameQuality[],
): RepQualityBreakdown {
  const framesTotal = perFrameQuality.length;
  if (framesTotal === 0) {
    return { flag: 'partial', framesMissing: 0, framesTotal: 0 };
  }

  let framesMissing = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const f of perFrameQuality) {
    const visUnder =
      typeof f.visibilityScore === 'number' && f.visibilityScore < VISIBILITY_FLOOR;
    if (!f.detected || visUnder) {
      framesMissing += 1;
    }
    if (typeof f.handednessScore === 'number') {
      confidenceSum += f.handednessScore;
      confidenceCount += 1;
    }
  }

  const missingRatio = framesMissing / framesTotal;
  const avgConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 1;

  let flag: RepQualityFlag;
  if (missingRatio > PARTIAL_VIS_RATIO) {
    flag = 'partial';
  } else if (missingRatio > LOW_VIS_RATIO) {
    flag = 'low_visibility';
  } else if (avgConfidence < LOW_CONFIDENCE_HANDEDNESS) {
    flag = 'low_confidence';
  } else {
    flag = 'clean';
  }

  return { flag, framesMissing, framesTotal };
}

// Default thresholds in clinical degrees (post-normalization). Crossing
// FLEXION_ENTER_DEG top-down opens a rep; crossing FLEXION_EXIT_DEG
// bottom-up closes it. The gap between them is the hysteresis band that
// prevents a finger oscillating around one threshold from double-counting.
const FLEXION_ENTER_DEG = 35;
const FLEXION_EXIT_DEG = 10;
// Eight frames at ~30 fps ≈ 270 ms — long enough to absorb single-frame
// MediaPipe glitches and short enough that it doesn't lag the live HUD.
const SMOOTHING_WINDOW = 8;

export type JointPeakMap = Partial<Record<JointName, { peakFlex: number; peakExt: number }>>;

export type JointRepCounterOptions = {
  flexionEnter?: number;
  flexionExit?: number;
  smoothingWindow?: number;
};

/**
 * Per-rep state captured every time `updateJointRepCounter` closes a rep.
 *
 * `peaks` carries the maximum flexion/extension reached on every joint that
 * was passed to `updateJointRepCounter` during the rep — so even when MCP
 * drives the counter, PIP/DIP peaks land in the rep payload.
 */
export type CompletedJointRep = {
  repNumber: number;
  peaks: JointPeakMap;
  framesMissing: number;
  framesTotal: number;
  quality: RepQualityBreakdown;
};

export type JointRepCounter = {
  flexionEnter: number;
  flexionExit: number;
  smoothingWindow: number;
  angleHistory: number[];
  /** 'open' = below exit threshold, 'flexed' = above enter threshold. */
  phase: 'open' | 'flexed' | null;
  repCount: number;
  /** Joint peaks accumulated for the rep currently in flight. */
  currentPeaks: JointPeakMap;
  /** Per-frame quality samples accumulated for the rep currently in flight. */
  currentFrameQuality: FrameQuality[];
  /** Set on the tick where a rep just closed; consumers can react and ignore on subsequent ticks. */
  completedRep?: CompletedJointRep;
};

export function createJointRepCounter(opts: JointRepCounterOptions = {}): JointRepCounter {
  return {
    flexionEnter: opts.flexionEnter ?? FLEXION_ENTER_DEG,
    flexionExit: opts.flexionExit ?? FLEXION_EXIT_DEG,
    smoothingWindow: opts.smoothingWindow ?? SMOOTHING_WINDOW,
    angleHistory: [],
    phase: null,
    repCount: 0,
    currentPeaks: {},
    currentFrameQuality: [],
    completedRep: undefined,
  };
}

/**
 * Advances the rep counter by one frame.
 *
 * @param counter             Previous counter state (treated as immutable; the function returns a new object).
 * @param normalizedAngleDeg  Driver angle in clinical degrees (post-normalization).
 *                            Positive = flexion, negative = extension. Pass `NaN`/`null`-equivalent
 *                            via the `frameQuality.detected = false` channel; this function expects a number.
 * @param jointAnglesByName   Optional map of every joint's normalized angle this frame, used to
 *                            update per-joint peaks. Keys must be JointName (`MCP` | `PIP` | `DIP` | `wrist`).
 * @param frameQuality        Optional per-frame quality signal. When omitted we synthesise a
 *                            "clean detected frame" from the fact that we got an angle at all.
 *
 * Hysteresis: a rep opens when the smoothed driver crosses `flexionEnter` from below, and closes
 * when it crosses `flexionExit` from above. Tiny oscillations around either threshold cannot
 * complete a rep on their own — both thresholds must be crossed in order.
 */
export function updateJointRepCounter(
  counter: JointRepCounter,
  normalizedAngleDeg: number,
  jointAnglesByName?: Partial<Record<JointName, number>>,
  frameQuality?: FrameQuality,
): JointRepCounter {
  const next: JointRepCounter = {
    ...counter,
    angleHistory: [...counter.angleHistory, normalizedAngleDeg],
    currentPeaks: { ...counter.currentPeaks },
    currentFrameQuality: [...counter.currentFrameQuality],
    completedRep: undefined,
  };

  if (next.angleHistory.length > next.smoothingWindow) {
    next.angleHistory = next.angleHistory.slice(-next.smoothingWindow);
  }

  // Record per-frame quality. A consumer that didn't give us anything is
  // treated as "detected, no extra info".
  next.currentFrameQuality.push(
    frameQuality ?? { detected: !Number.isNaN(normalizedAngleDeg) },
  );

  // Update per-joint peaks for the rep currently in flight. Positive values
  // contribute to peakFlex; negatives to peakExt.
  if (jointAnglesByName) {
    for (const [k, vRaw] of Object.entries(jointAnglesByName)) {
      if (typeof vRaw !== 'number' || Number.isNaN(vRaw)) continue;
      const joint = k as JointName;
      const slot = next.currentPeaks[joint] ?? { peakFlex: 0, peakExt: 0 };
      if (vRaw > 0) {
        slot.peakFlex = Math.max(slot.peakFlex, Math.round(vRaw));
      } else if (vRaw < 0) {
        slot.peakExt = Math.max(slot.peakExt, Math.round(Math.abs(vRaw)));
      }
      next.currentPeaks[joint] = slot;
    }
  }

  // We need the smoothing buffer half-full before trusting the average; this
  // mirrors the legacy counter and prevents a single huge first frame from
  // flipping the state machine immediately.
  const minSamples = Math.max(2, Math.floor(next.smoothingWindow / 2));
  if (next.angleHistory.length < minSamples) {
    return next;
  }

  const smoothed =
    next.angleHistory.reduce((a, b) => a + b, 0) / next.angleHistory.length;

  // State machine.
  if (smoothed >= next.flexionEnter) {
    next.phase = 'flexed';
  } else if (smoothed <= next.flexionExit) {
    if (counter.phase === 'flexed') {
      // Rep just closed: snapshot peaks + quality, increment, reset accumulators.
      next.repCount = counter.repCount + 1;
      const quality = classifyRepQuality(next.currentFrameQuality);
      next.completedRep = {
        repNumber: next.repCount,
        peaks: next.currentPeaks,
        framesMissing: quality.framesMissing,
        framesTotal: quality.framesTotal,
        quality,
      };
      next.currentPeaks = {};
      next.currentFrameQuality = [];
    }
    next.phase = 'open';
  }
  // else: in the dead band between exit and enter — no transition.

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
