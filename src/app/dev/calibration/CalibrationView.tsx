'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FINGERS,
  JOINT_CALIBRATION,
  calculateAllJointAngles,
  calculateJointAngles,
  drawHand,
  normalizeJointAngle,
  DEFAULT_FINGER_STATUS,
  type FingerConfig,
  type FingerJointAngles,
  type FingerName,
  type HandChirality,
  type JointAngles,
  type Point,
} from '@/lib/hand-tracking';

/**
 * Calibration tool for the finger joints (IA-04, surgeon feedback 2026-06-15).
 *
 * The datum the surgeon trusts is a GONIOMETER reading on ONE joint of ONE
 * finger. The geometry in `calculateJointAngles(...)` is correct; what was
 * wrong is the CALIBRATION — the prior open/fist capture averaged across long
 * fingers and never referenced a real goniometer.
 *
 * This view rebuilds the capture model around:
 *  1. A target-finger AND target-joint selector (calibrate ONE joint of ONE
 *     finger at a time). The surgeon now hands us goniometer photos of MCP,
 *     PIP and DIP, so restricting the tool to the MCP would leave two thirds of
 *     the evidence unusable.
 *  2. An on-video overlay that draws exactly what is measured for the SELECTED
 *     joint (its two bone segments plus the vertex arc), so the operator can
 *     see the tool measures where he places the goniometer.
 *  3. Multi-point goniometer-referenced capture: the operator measures the real
 *     clinical angle with a physical goniometer, types it in, and captures the
 *     pair { raw, clinical }. A least-squares line over the points yields
 *     measuredOpen / measuredClosed for that joint's JOINT_CALIBRATION entry.
 *
 * CHIRALITY (2026-09-09). Every angle read here passes the detected MediaPipe
 * handedness into `calculateJointAngles`. Without it the sign of the reading
 * depends on how the hand happens to be projected (which side faces the camera,
 * which hand it is), so points captured across poses would not be comparable
 * with each other and the fit would be garbage. See `flexionSignFor` in
 * `@/lib/hand-tracking`.
 *
 * The camera / MediaPipe / rAF loop / detection infrastructure is preserved from
 * the previous version; only the capture model and overlay are new.
 */

type HandednessEntry = { categoryName?: string; score?: number };

type HandLandmarkerResult = {
  landmarks?: Array<Array<{ x: number; y: number; z: number; visibility?: number }>>;
  worldLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
  handedness?: Array<Array<HandednessEntry>>;
  handednesses?: Array<Array<HandednessEntry>>; // older field name in some builds
};

type HandLandmarkerInstance = {
  detectForVideo: (video: HTMLVideoElement, ts: number) => HandLandmarkerResult;
  close?: () => void;
};

/** Image-mode landmarker: a separate instance running in `IMAGE` mode. */
type HandLandmarkerImageInstance = {
  detect: (image: HTMLImageElement | HTMLCanvasElement | ImageBitmap) => HandLandmarkerResult;
  close?: () => void;
};

const MEDIAPIPE_WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const ALL_FINGER_NAMES: FingerName[] = ['pulgar', 'indice', 'medio', 'anular', 'menique'];

/**
 * Joints this tool can calibrate. The wrist is deliberately excluded: it needs a
 * forearm reference point the calibration rig does not provide (see the note on
 * `JOINT_CALIBRATION.wrist`).
 */
type TargetJoint = 'MCP' | 'PIP' | 'DIP';

const ALL_TARGET_JOINTS: TargetJoint[] = ['MCP', 'PIP', 'DIP'];

type JointMeta = {
  /** Full clinical name, for headings and instructions. */
  fullLabel: string;
  /** Proximal segment of the angle (drawn blue), in the surgeon's language. */
  proximalLabel: string;
  /** Distal segment of the angle (drawn orange). */
  distalLabel: string;
};

/**
 * How each joint is measured, described the way the surgeon places the
 * goniometer: two bone segments meeting at the joint's vertex. The overlay draws
 * exactly this, so the wording here and the drawing must stay in sync.
 */
const JOINT_META: Record<TargetJoint, JointMeta> = {
  MCP: {
    fullLabel: 'Metacarpofalángica (MCP)',
    proximalLabel: 'metacarpiano (muñeca → nudillo)',
    distalLabel: 'falange proximal (nudillo → PIP)',
  },
  PIP: {
    fullLabel: 'Interfalángica proximal (PIP)',
    proximalLabel: 'falange proximal (nudillo → PIP)',
    distalLabel: 'falange media (PIP → DIP)',
  },
  DIP: {
    fullLabel: 'Interfalángica distal (DIP)',
    proximalLabel: 'falange media (PIP → DIP)',
    distalLabel: 'falange distal (DIP → punta)',
  },
};

/**
 * Clinical bounds come from `JOINT_CALIBRATION` — the same table the export is
 * pasted back into — instead of being duplicated here. Hardcoding them once
 * meant the tool could only ever speak about the MCP's 0–90° range.
 */
function clinicalMaxOf(joint: TargetJoint): number {
  return JOINT_CALIBRATION[joint].clinicalMax;
}

function clinicalMinOf(joint: TargetJoint): number {
  return JOINT_CALIBRATION[joint].clinicalMin ?? 0;
}

/**
 * The landmark triplet whose VERTEX is the joint being calibrated:
 *   MCP → muñeca · nudillo · PIP
 *   PIP → nudillo · PIP · DIP
 *   DIP → PIP · DIP · punta
 * Written as ifs (not a switch) so TypeScript sees a total function without an
 * unreachable default branch.
 */
function jointLandmarkIndices(
  finger: FingerConfig,
  joint: TargetJoint,
): { start: number; vertex: number; end: number } {
  if (joint === 'MCP') {
    return { start: 0, vertex: finger.mcpIndex, end: finger.pipIndex };
  }
  if (joint === 'PIP') {
    return { start: finger.mcpIndex, vertex: finger.pipIndex, end: finger.dipIndex };
  }
  return { start: finger.pipIndex, vertex: finger.dipIndex, end: finger.tipIndex };
}

/**
 * Narrows MediaPipe's raw handedness string to the lib's `HandChirality`.
 * Anything else (missing field, unexpected label) yields `undefined`, which
 * makes `calculateJointAngles` fall back to its legacy sign — visibly flagged in
 * the UI so the operator does not capture points he cannot compare.
 */
function toChirality(categoryName?: string): HandChirality | undefined {
  return categoryName === 'Left' || categoryName === 'Right' ? categoryName : undefined;
}

/** Colors for the "what is measured" overlay. */
const PROXIMAL_COLOR = '#007AFF'; // blue — proximal segment of the joint
const DISTAL_COLOR = '#FB923C'; // orange — distal segment of the joint
const ARC_COLOR = '#FACC15'; // yellow — vertex arc

/**
 * A single goniometer-referenced sample: the raw reading (degrees) of the
 * selected joint of the selected finger at the instant of capture, paired with
 * the clinical angle the operator measured with a physical goniometer for that
 * exact pose.
 */
type CapturePoint = {
  id: string;
  raw: number;
  clinical: number;
  capturedAt: string;
  /** Where the point came from: live camera read-out or an uploaded photo. */
  source: 'live' | 'photo';
  /** Original file name when `source === 'photo'`. */
  fileName?: string;
  /**
   * Chirality the raw reading was signed with. Recorded for traceability: a
   * point read without chirality is not comparable with the rest.
   */
  chirality?: HandChirality;
};

/**
 * A photo uploaded by the surgeon and processed by the IMAGE-mode landmarker.
 * Holds the detection outcome for the finger AND joint that were active when it
 * was processed, plus the clinical angle being entered for it.
 */
type ProcessedPhoto = {
  id: string;
  fileName: string;
  /** Object URL of the uploaded image, used for rendering. Revoked on removal. */
  objectUrl: string;
  /** The finger the raw angle was computed for (so we can detect stale photos). */
  finger: FingerName;
  /** The joint the raw angle was computed for (same staleness reason). */
  joint: TargetJoint;
  /** Raw angle of the selected joint, or null when no hand was detected. */
  raw: number | null;
  /** Chirality MediaPipe reported for this photo, used to sign the reading. */
  chirality?: HandChirality;
  /** Detected landmarks (normalised 0..1), kept for the overlay. */
  landmarks: Point[] | null;
  /** Natural pixel size of the source image, for the cover remap. */
  imageW: number;
  imageH: number;
  /** Per-photo error (e.g. no hand detected, decode failure). */
  error: string | null;
  /** Clinical angle the surgeon wrote for this pose. */
  clinicalInput: string;
};

/** Result of the least-squares fit `clinical = m·raw + b`. */
type LinearFit =
  | {
      ok: true;
      slope: number;
      intercept: number;
      /** raw where clinical = 0 → measuredOpen. */
      measuredOpen: number;
      /** raw where clinical = clinicalMax of the joint → measuredClosed. */
      measuredClosed: number;
      /** Coefficient of determination, 0..1 (1 for the exact 2-point line). */
      r2: number;
      /** Largest absolute residual in clinical degrees. */
      maxError: number;
    }
  | { ok: false; reason: string };

function pickHandedness(result: HandLandmarkerResult, idx: number): HandednessEntry | null {
  const arr = result.handedness ?? result.handednesses;
  return arr?.[idx]?.[0] ?? null;
}

function avgVisibility(landmarks: Array<{ visibility?: number }>): number | null {
  const vs = landmarks.map((l) => l.visibility).filter((v): v is number => typeof v === 'number');
  if (vs.length === 0) return null;
  return vs.reduce((a, b) => a + b, 0) / vs.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Maps a normalised MediaPipe landmark to canvas pixel coordinates, replicating
 * the `object-fit: cover` remap that `drawHand`/`toCanvas` use so overlay points
 * land exactly on the video. The canvas carries CSS `-scale-x-100` (same as the
 * video), so we draw in un-flipped coords just like `drawHand` does.
 */
function toCanvasPx(
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
 * Draws the "what is measured" overlay for the SELECTED joint of the selected
 * finger: its proximal segment (blue), its distal segment (orange) and an arc at
 * the joint vertex labelled with the raw angle.
 *
 * Drawing the MCP triplet regardless of the joint under calibration (the old
 * behaviour) was actively misleading: the surgeon compares the overlay against
 * where he puts the goniometer, so it must follow the selector.
 */
function drawJointOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: Point[],
  finger: FingerConfig,
  joint: TargetJoint,
  rawAngle: number,
  canvasW: number,
  canvasH: number,
  videoW: number,
  videoH: number,
  /**
   * When the canvas carries CSS `scaleX(-1)` (live video) the text must be
   * counter-flipped to read normally. For photos (no flip) pass `false`.
   */
  flipText = true,
) {
  const px = (lm: Point) => toCanvasPx(lm, videoW, videoH, canvasW, canvasH);
  const indices = jointLandmarkIndices(finger, joint);
  const start = px(landmarks[indices.start]);
  const vertex = px(landmarks[indices.vertex]);
  const end = px(landmarks[indices.end]);

  // Proximal segment: start → vertex (blue).
  ctx.strokeStyle = PROXIMAL_COLOR;
  ctx.lineWidth = 4;
  ctx.setLineDash([]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(vertex.x, vertex.y);
  ctx.stroke();

  // Distal segment: vertex → end (orange).
  ctx.strokeStyle = DISTAL_COLOR;
  ctx.beginPath();
  ctx.moveTo(vertex.x, vertex.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  // Endpoint dots.
  for (const [p, color] of [
    [start, PROXIMAL_COLOR],
    [vertex, '#ffffff'],
    [end, DISTAL_COLOR],
  ] as const) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Arc at the joint vertex. The arc spans from the proximal direction to the
  // distal direction, drawn in screen space so it visually traces the angle.
  const angA = Math.atan2(start.y - vertex.y, start.x - vertex.x);
  const angB = Math.atan2(end.y - vertex.y, end.x - vertex.x);
  // Draw only the minor arc (the actual joint angle), not the full ring.
  let delta = angB - angA;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  // The interphalangeal joints sit closer together than the MCP, so a fixed
  // radius would swallow the whole finger: cap it to a fraction of the shorter
  // segment.
  const segLen = Math.min(
    Math.hypot(start.x - vertex.x, start.y - vertex.y),
    Math.hypot(end.x - vertex.x, end.y - vertex.y),
  );
  const radius = Math.max(10, Math.min(26, segLen * 0.6));
  ctx.strokeStyle = ARC_COLOR;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(vertex.x, vertex.y, radius, angA, angA + delta, delta < 0);
  ctx.stroke();

  // Angle label near the vertex. Counter-flip text because the canvas has
  // CSS scaleX(-1) (mirrors `drawHand`'s text handling).
  const label = `${joint} ${Math.round(rawAngle)}° raw`;
  ctx.save();
  ctx.translate(vertex.x, vertex.y - 34);
  if (flipText) ctx.scale(-1, 1);
  ctx.font = 'bold 13px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(label).width + 12;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(-tw / 2, -11, tw, 22, 5);
  ctx.fill();
  ctx.fillStyle = ARC_COLOR;
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

/**
 * Least-squares fit `clinical = m·raw + b` over the captured points. With
 * exactly 2 points this is the line through them (R² = 1). Returns a degenerate
 * marker (`ok:false`) when there are <2 points or the slope is non-positive
 * (which would invert the calibration and break normalization downstream).
 */
function fitLinear(points: CapturePoint[], clinicalMax: number): LinearFit {
  if (points.length < 2) {
    return { ok: false, reason: 'Captura al menos 2 puntos para calcular el ajuste.' };
  }
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const p of points) {
    sumX += p.raw;
    sumY += p.clinical;
    sumXY += p.raw * p.clinical;
    sumXX += p.raw * p.raw;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) {
    return {
      ok: false,
      reason: 'Los puntos tienen el mismo valor crudo (recta vertical). Captura posiciones distintas.',
    };
  }
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  if (!Number.isFinite(slope) || slope <= 0) {
    return {
      ok: false,
      reason:
        'La pendiente del ajuste es ≤0: el crudo no crece con el ángulo clínico. Revisa los puntos (¿mano de perfil?, ¿signo invertido?).',
    };
  }

  // R² and max residual.
  const meanY = sumY / n;
  let ssRes = 0;
  let ssTot = 0;
  let maxError = 0;
  for (const p of points) {
    const pred = slope * p.raw + intercept;
    const res = p.clinical - pred;
    ssRes += res * res;
    ssTot += (p.clinical - meanY) ** 2;
    maxError = Math.max(maxError, Math.abs(res));
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  const measuredOpen = -intercept / slope; // raw at clinical = 0
  // raw at clinical = clinicalMax (90 MCP / 100 PIP / 80 DIP).
  const measuredClosed = (clinicalMax - intercept) / slope;

  return {
    ok: true,
    slope,
    intercept,
    measuredOpen,
    measuredClosed,
    r2,
    maxError,
  };
}

/** Line ready to paste into `JOINT_CALIBRATION` for the calibrated joint. */
function buildJointJson(joint: TargetJoint, fit: LinearFit): string {
  if (!fit.ok) {
    return `// ${fit.reason}`;
  }
  return `${joint}: { measuredOpen: ${round1(fit.measuredOpen)}, measuredClosed: ${round1(
    fit.measuredClosed,
  )}, clinicalMax: ${clinicalMaxOf(joint)}, clinicalMin: ${clinicalMinOf(joint)} },`;
}

/** Loads a File into a decoded HTMLImageElement (rejects on decode error). */
function loadImage(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se ha podido leer la imagen.'));
    img.src = objectUrl;
  });
}

/** Lazily creates an IMAGE-mode HandLandmarker (GPU → CPU fallback). */
async function createImageLandmarker(): Promise<HandLandmarkerImageInstance> {
  const vision = await import('@mediapipe/tasks-vision');
  const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
  const make = async (delegate: 'GPU' | 'CPU') =>
    (await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: HAND_LANDMARKER_MODEL_URL, delegate },
      numHands: 1,
      runningMode: 'IMAGE',
    })) as unknown as HandLandmarkerImageInstance;
  try {
    return await make('GPU');
  } catch {
    return await make('CPU');
  }
}

export function CalibrationView() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<HandLandmarkerInstance | null>(null);
  const imageLandmarkerRef = useRef<HandLandmarkerImageInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // Live read-outs are kept in refs (mutated each frame) and surfaced to React
  // via a single `tick` counter so we don't re-render at 30Hz on every value.
  const liveFingerJointsRef = useRef<Record<FingerName, JointAngles> | null>(null);
  // `label` is the narrowed chirality actually fed to `calculateJointAngles`;
  // `rawLabel` keeps whatever MediaPipe said so the panel can show an
  // unexpected value instead of silently blanking it.
  const liveHandednessRef = useRef<{
    label?: HandChirality;
    rawLabel?: string;
    score?: number;
  }>({});
  const liveVisibilityRef = useRef<number | null>(null);
  const liveDetectedRef = useRef<boolean>(false);

  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const showLandmarksRef = useRef(true);
  showLandmarksRef.current = showLandmarks;

  // Target finger + joint to calibrate (THIS joint of THIS finger is the
  // protagonist: overlay, read-outs, capture points and export all follow it).
  const [targetFinger, setTargetFinger] = useState<FingerName>('indice');
  const targetFingerRef = useRef<FingerName>('indice');
  targetFingerRef.current = targetFinger;

  const [targetJoint, setTargetJoint] = useState<TargetJoint>('MCP');
  const targetJointRef = useRef<TargetJoint>('MCP');
  targetJointRef.current = targetJoint;

  // Goniometer-referenced capture points + the clinical value being entered.
  const [points, setPoints] = useState<CapturePoint[]>([]);
  const [clinicalInput, setClinicalInput] = useState<string>('');

  // Photo-based calibration: processed uploads + processing state.
  const [photos, setPhotos] = useState<ProcessedPhoto[]>([]);
  const photosRef = useRef<ProcessedPhoto[]>([]);
  photosRef.current = photos;
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    try {
      landmarkerRef.current?.close?.();
    } catch {
      // ignore
    }
    landmarkerRef.current = null;
    setRunning(false);
  }, []);

  // Closes the image landmarker and revokes any pending photo object URLs.
  // Used on unmount so we never leak the WASM instance or blob URLs.
  const cleanupPhotos = useCallback(() => {
    try {
      imageLandmarkerRef.current?.close?.();
    } catch {
      // ignore
    }
    imageLandmarkerRef.current = null;
    for (const p of photosRef.current) URL.revokeObjectURL(p.objectUrl);
  }, []);

  useEffect(
    () => () => {
      stop();
      cleanupPhotos();
    },
    [stop, cleanupPhotos],
  );

  const renderLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const lm = landmarkerRef.current;
    if (!video || !canvas || !lm) {
      rafRef.current = requestAnimationFrame(renderLoop);
      return;
    }
    if (video.readyState < 2) {
      rafRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    const result = lm.detectForVideo(video, performance.now());
    const hand = result.landmarks?.[0] ?? null;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(rect.width * dpr)) canvas.width = Math.round(rect.width * dpr);
    if (canvas.height !== Math.round(rect.height * dpr)) canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      rafRef.current = requestAnimationFrame(renderLoop);
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (hand) {
      liveDetectedRef.current = true;
      const handedness = pickHandedness(result, 0);
      const chirality = toChirality(handedness?.categoryName);
      liveHandednessRef.current = {
        label: chirality,
        rawLabel: handedness?.categoryName,
        score: handedness?.score,
      };
      liveVisibilityRef.current = avgVisibility(hand);

      // Chirality MUST travel with the landmarks: the flexion sign is measured
      // in image space and flips when the projected hand is mirrored, so a
      // reading taken without it is not a clinical quantity (see `flexionSignFor`).
      const all: FingerJointAngles = calculateAllJointAngles(hand, chirality);
      liveFingerJointsRef.current = all;

      const videoW = video.videoWidth || rect.width;
      const videoH = video.videoHeight || rect.height;

      if (showLandmarksRef.current) {
        const fingerAnglesForDraw = {
          pulgar: 0, indice: 0, medio: 0, anular: 0, menique: 0,
        };
        drawHand(
          ctx,
          hand,
          rect.width,
          rect.height,
          videoW,
          videoH,
          DEFAULT_FINGER_STATUS,
          fingerAnglesForDraw,
        );
      }

      // "What is measured" overlay for the selected finger + joint, always on
      // top. Reuses the angles already computed above (same chirality).
      const finger = FINGERS.find((f) => f.name === targetFingerRef.current);
      if (finger) {
        const joint = targetJointRef.current;
        const rawAngle = all[finger.name][joint];
        drawJointOverlay(
          ctx,
          hand,
          finger,
          joint,
          rawAngle,
          rect.width,
          rect.height,
          videoW,
          videoH,
        );
      }
    } else {
      liveDetectedRef.current = false;
      liveVisibilityRef.current = null;
      liveHandednessRef.current = {};
    }

    // Throttle React updates to ~10 Hz — enough for a live read-out without
    // forcing a re-render of the panel on every rAF tick.
    setTick((t) => (t + 1) % 1_000_000);
    rafRef.current = requestAnimationFrame(renderLoop);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
    } catch {
      setError('No se ha podido acceder a la cámara.');
      return;
    }

    setRunning(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const video = videoRef.current;
    if (video && streamRef.current) {
      video.srcObject = streamRef.current;
      try {
        await video.play();
      } catch {
        // ignored — user gesture should satisfy autoplay policy
      }
    }

    try {
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
      const inst = (await vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: HAND_LANDMARKER_MODEL_URL,
          delegate: 'GPU',
        },
        numHands: 1,
        runningMode: 'VIDEO',
      })) as unknown as HandLandmarkerInstance;
      landmarkerRef.current = inst;
    } catch {
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
        const inst = (await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: HAND_LANDMARKER_MODEL_URL,
            delegate: 'CPU',
          },
          numHands: 1,
          runningMode: 'VIDEO',
        })) as unknown as HandLandmarkerInstance;
        landmarkerRef.current = inst;
      } catch {
        setError('No se ha podido cargar el detector de mano.');
        stop();
        return;
      }
    }

    rafRef.current = requestAnimationFrame(renderLoop);
  }, [renderLoop, stop]);

  const capturePoint = useCallback(() => {
    if (!liveFingerJointsRef.current || !liveDetectedRef.current) return;
    const clinical = Number.parseFloat(clinicalInput.replace(',', '.'));
    if (!Number.isFinite(clinical)) {
      setError('Introduce un ángulo clínico válido (grados, admite negativos).');
      return;
    }
    setError(null);
    const raw = liveFingerJointsRef.current[targetFingerRef.current]?.[targetJointRef.current];
    if (typeof raw !== 'number' || Number.isNaN(raw)) return;
    const point: CapturePoint = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      raw,
      clinical,
      capturedAt: new Date().toISOString(),
      source: 'live',
      chirality: liveHandednessRef.current.label,
    };
    setPoints((prev) => [...prev, point].sort((a, b) => a.clinical - b.clinical));
    setClinicalInput('');
  }, [clinicalInput]);

  const removePoint = useCallback((id: string) => {
    setPoints((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Every captured point belongs to one (finger, joint) pair: mixing points
  // from two fingers — or from two joints, whose clinical ranges and geometry
  // differ — would corrupt the fit. So any change of target wipes the captures.
  // Processed photos are tied to the target active at processing time too, so
  // we drop them (and revoke their object URLs) rather than show stale raws.
  const resetCaptures = useCallback(() => {
    setPoints([]);
    setClinicalInput('');
    setError(null);
    setPhotos((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.objectUrl);
      return [];
    });
  }, []);

  const switchFinger = useCallback(
    (name: FingerName) => {
      if (name === targetFingerRef.current) return;
      setTargetFinger(name);
      resetCaptures();
    },
    [resetCaptures],
  );

  const switchJoint = useCallback(
    (joint: TargetJoint) => {
      if (joint === targetJointRef.current) return;
      setTargetJoint(joint);
      resetCaptures();
    },
    [resetCaptures],
  );

  // ----- photo-based calibration -----

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.objectUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const setPhotoClinical = useCallback((id: string, value: string) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, clinicalInput: value } : p)));
  }, []);

  const handlePhotoFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      if (files.length === 0) {
        setError('Selecciona archivos de imagen válidos.');
        return;
      }
      setError(null);
      setProcessingPhotos(true);
      const finger = targetFingerRef.current;
      const joint = targetJointRef.current;
      const cfg = FINGERS.find((f) => f.name === finger);
      try {
        if (!imageLandmarkerRef.current) {
          imageLandmarkerRef.current = await createImageLandmarker();
        }
        const landmarker = imageLandmarkerRef.current;
        for (const file of files) {
          const objectUrl = URL.createObjectURL(file);
          const base: ProcessedPhoto = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            fileName: file.name,
            objectUrl,
            finger,
            joint,
            raw: null,
            landmarks: null,
            imageW: 0,
            imageH: 0,
            error: null,
            clinicalInput: '',
          };
          try {
            const img = await loadImage(objectUrl);
            const result = landmarker.detect(img);
            const hand = result.landmarks?.[0] ?? null;
            if (!hand || !cfg) {
              base.error = 'No se ha detectado ninguna mano en la foto.';
            } else {
              // Same rule as the live loop: sign the reading with the chirality
              // MediaPipe reports for THIS photo. A photo of the other side of
              // the hand would otherwise contribute an inverted raw value.
              const chirality = toChirality(pickHandedness(result, 0)?.categoryName);
              base.landmarks = hand;
              base.chirality = chirality;
              base.imageW = img.naturalWidth;
              base.imageH = img.naturalHeight;
              base.raw = calculateJointAngles(hand, cfg, chirality)[joint];
            }
          } catch {
            base.error = 'No se ha podido procesar la imagen.';
          }
          setPhotos((prev) => [...prev, base]);
        }
      } catch {
        setError('No se ha podido cargar el detector de mano para imágenes.');
      } finally {
        setProcessingPhotos(false);
      }
    },
    [],
  );

  // Adds a processed photo (with a valid clinical input) to the shared points
  // list, tagged as a photo-sourced point so it co-fits with the live captures.
  const addPhotoPoint = useCallback(
    (id: string) => {
      const photo = photosRef.current.find((p) => p.id === id);
      if (!photo || photo.raw === null) return;
      // Guard against a stale photo whose finger/joint no longer matches the
      // target (belt and braces: switching target already clears the photos).
      if (photo.finger !== targetFingerRef.current || photo.joint !== targetJointRef.current) {
        setError(
          'Esta foto se procesó para otro dedo o articulación. Vuelve a subirla con la selección actual.',
        );
        return;
      }
      const clinical = Number.parseFloat(photo.clinicalInput.replace(',', '.'));
      if (!Number.isFinite(clinical)) {
        setError('Introduce un ángulo clínico válido para la foto (grados, admite negativos).');
        return;
      }
      setError(null);
      const point: CapturePoint = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        raw: photo.raw,
        clinical,
        capturedAt: new Date().toISOString(),
        source: 'photo',
        fileName: photo.fileName,
        chirality: photo.chirality,
      };
      setPoints((prev) => [...prev, point].sort((a, b) => a.clinical - b.clinical));
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, clinicalInput: '' } : p)));
    },
    [],
  );

  const jointMeta = JOINT_META[targetJoint];
  const clinicalMax = clinicalMaxOf(targetJoint);
  const clinicalMin = clinicalMinOf(targetJoint);

  const fit = useMemo(() => fitLinear(points, clinicalMax), [points, clinicalMax]);
  const json = buildJointJson(targetJoint, fit);
  void tick; // referenced to keep the panel reactive at ~10Hz

  // ----- read-outs (computed each render from refs, ~10Hz) -----
  const live = liveFingerJointsRef.current;
  const handedness = liveHandednessRef.current;
  const visibility = liveVisibilityRef.current;
  const detected = liveDetectedRef.current;
  const lowConfidence = (handedness.score ?? 1) < 0.7;
  const lowVisibility = visibility !== null && visibility < 0.4;
  // No usable chirality → the sign of the reading is arbitrary; warn loudly
  // instead of letting the operator capture points he cannot compare.
  const unknownChirality = detected && handedness.label === undefined;

  const targetConfig = FINGERS.find((f) => f.name === targetFinger)!;
  const targetRaw = live?.[targetFinger]?.[targetJoint];
  const targetNorm =
    typeof targetRaw === 'number' ? normalizeJointAngle(targetRaw, targetJoint) : null;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 p-4 lg:flex-row">
        {/* Left: control + read-out panel */}
        <aside className="w-full shrink-0 lg:w-[460px]">
          <header className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
              Dev tool
            </p>
            {/*
              Heading kept STATIC on purpose: it no longer names a joint (the
              tool calibrates MCP/PIP/DIP) and the e2e gate spec asserts it, so a
              title that changed with the selector would be brittle.
            */}
            <h1 className="mt-1 text-[18px] font-semibold">Calibración articular (IA-04)</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
              Calibra la articulación <strong>{jointMeta.fullLabel}</strong> del{' '}
              <strong>{targetConfig.label.toLowerCase()}</strong> contra un{' '}
              <strong>goniómetro real</strong>. Se mide el ángulo entre el{' '}
              {jointMeta.proximalLabel} y la {jointMeta.distalLabel}.
            </p>
            <p className="mt-2 rounded-lg bg-blue-50 p-2 text-[12px] leading-relaxed text-blue-800">
              Coloca la mano <strong>de perfil</strong> a la cámara: el ángulo se
              mide en el plano de la imagen. El dedo debe verse completo.
            </p>
            {!running ? (
              <button
                type="button"
                onClick={start}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[#007AFF] px-4 text-[14px] font-semibold text-white"
              >
                Iniciar cámara
              </button>
            ) : (
              <button
                type="button"
                onClick={stop}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-gray-100 px-4 text-[14px] font-semibold text-gray-700"
              >
                Detener
              </button>
            )}
            {error ? (
              <p className="mt-3 rounded-lg bg-red-50 p-2 text-[13px] text-red-700">{error}</p>
            ) : null}
            <label className="mt-4 flex items-center gap-2 text-[13px] text-gray-700">
              <input
                type="checkbox"
                checked={showLandmarks}
                onChange={(e) => setShowLandmarks(e.target.checked)}
              />
              Mostrar landmarks
            </label>
          </header>

          {/* Target finger + joint selectors */}
          <section className="mt-3 rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="text-[14px] font-semibold">Dedo a calibrar</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ALL_FINGER_NAMES.map((name) => {
                const cfg = FINGERS.find((f) => f.name === name)!;
                const active = name === targetFinger;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => switchFinger(name)}
                    aria-pressed={active}
                    className={
                      'h-9 flex-1 rounded-xl px-2 text-[13px] font-semibold ' +
                      (active
                        ? 'bg-[#007AFF] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                    }
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            <h2 className="mt-4 text-[14px] font-semibold">Articulación a calibrar</h2>
            <div className="mt-2 flex gap-1.5">
              {ALL_TARGET_JOINTS.map((joint) => {
                const active = joint === targetJoint;
                return (
                  <button
                    key={joint}
                    type="button"
                    onClick={() => switchJoint(joint)}
                    aria-pressed={active}
                    title={JOINT_META[joint].fullLabel}
                    className={
                      'h-9 flex-1 rounded-xl px-2 text-[13px] font-semibold ' +
                      (active
                        ? 'bg-[#007AFF] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                    }
                  >
                    {joint}
                  </button>
                );
              })}
            </div>

            {/* Big live read-out of the selected joint */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  {targetJoint} crudo
                </p>
                <p className="mt-1 font-mono text-[26px] font-semibold tabular-nums text-gray-900">
                  {typeof targetRaw === 'number' ? `${targetRaw.toFixed(1)}°` : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 p-3 text-center">
                <p className="text-[11px] uppercase tracking-wide text-blue-500">
                  {targetJoint} normalizado
                </p>
                <p className="mt-1 font-mono text-[26px] font-semibold tabular-nums text-blue-700">
                  {typeof targetNorm === 'number' ? `${targetNorm.toFixed(1)}°` : '—'}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
              {targetConfig.label} · {targetJoint}: {jointMeta.proximalLabel} en
              azul, {jointMeta.distalLabel} en naranja sobre el vídeo. Rango
              clínico {clinicalMin}° a {clinicalMax}°.
            </p>
          </section>

          {/* Confidence indicator */}
          <section className="mt-3 rounded-2xl border border-gray-200 bg-white p-4 text-[13px]">
            <h2 className="text-[14px] font-semibold">Detección</h2>
            <ul className="mt-2 space-y-1 text-gray-700">
              <li className="flex justify-between">
                <span>Mano detectada</span>
                <span className={detected ? 'text-emerald-600' : 'text-red-600'}>
                  {detected ? 'sí' : 'no'}
                </span>
              </li>
              <li className="flex justify-between">
                <span>Quiralidad (handedness)</span>
                <span>
                  {handedness.rawLabel ?? '—'}
                  {typeof handedness.score === 'number'
                    ? ` (${handedness.score.toFixed(2)})`
                    : ''}
                </span>
              </li>
              <li className="flex justify-between">
                <span>Visibilidad media</span>
                <span>
                  {typeof visibility === 'number' ? visibility.toFixed(2) : '—'}
                </span>
              </li>
            </ul>
            {(lowConfidence || lowVisibility) && detected ? (
              <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[12px] text-amber-800">
                {lowVisibility ? 'Baja visibilidad. ' : ''}
                {lowConfidence ? 'Baja confianza de quiralidad. ' : ''}
                Las medidas pueden no ser fiables.
              </p>
            ) : null}
            {unknownChirality ? (
              <p className="mt-2 rounded-lg bg-red-50 p-2 text-[12px] leading-relaxed text-red-700">
                Sin quiralidad utilizable: el signo del ángulo depende de cómo se
                proyecta la mano, así que los puntos capturados ahora no serían
                comparables. Recoloca la mano antes de capturar.
              </p>
            ) : null}
          </section>

          {/* All fingers / all joints reference (small) */}
          <section className="mt-3 rounded-2xl border border-gray-200 bg-white p-4 text-[13px]">
            <h2 className="text-[14px] font-semibold">Ángulos de todos los dedos</h2>
            <p className="mt-1 text-[11px] text-gray-500">
              Referencia en crudo. El protagonista es la columna{' '}
              <strong>{targetJoint}</strong> del dedo seleccionado; el resto es
              sólo información (fuera del alcance del export).
            </p>
            <div className="mt-2 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 font-mono text-[12px]">
              <span className="font-semibold">Dedo</span>
              {ALL_TARGET_JOINTS.map((joint) => (
                <span
                  key={joint}
                  className={
                    'text-right font-semibold ' +
                    (joint === targetJoint ? 'text-[#007AFF]' : '')
                  }
                >
                  {joint}
                </span>
              ))}
              {ALL_FINGER_NAMES.map((name) => {
                const cfg = FINGERS.find((f) => f.name === name)!;
                const angles = live?.[name];
                const isTarget = name === targetFinger;
                return (
                  <FingerJointsRow
                    key={name}
                    label={cfg.label}
                    angles={angles}
                    highlightFinger={isTarget}
                    highlightJoint={targetJoint}
                  />
                );
              })}
            </div>
          </section>

          {/* Multi-point goniometer-referenced capture */}
          <section className="mt-3 rounded-2xl border border-gray-200 bg-white p-4 text-[13px]">
            <h2 className="text-[14px] font-semibold">Captura goniómetro-referenciada</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-gray-600">
              Coloca el dedo en una posición cuya {targetJoint} hayas medido con
              goniómetro, escribe ese ángulo clínico (grados, admite negativos
              p.ej. hiperextensión) y pulsa <strong>Capturar punto</strong>.
              Captura al menos 2 posiciones bien separadas (extensión ≈0° y
              flexión ≈{clinicalMax}°), idealmente 3+.
            </p>
            <div className="mt-3 flex items-end gap-2">
              <label className="flex-1">
                <span className="block text-[11px] text-gray-500">Ángulo clínico (°)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={clinicalInput}
                  onChange={(e) => setClinicalInput(e.target.value)}
                  placeholder={`p.ej. 0, ${Math.round(clinicalMax / 2)}, ${clinicalMax}`}
                  className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-[14px] tabular-nums outline-none focus:border-[#007AFF]"
                />
              </label>
              <button
                type="button"
                disabled={!detected || clinicalInput.trim() === ''}
                onClick={capturePoint}
                className="h-10 rounded-xl bg-[#007AFF] px-4 text-[13px] font-semibold text-white disabled:bg-gray-200 disabled:text-gray-500"
              >
                Capturar punto
              </button>
            </div>

            {/* Captured points list */}
            {points.length > 0 ? (
              <div className="mt-3">
                <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-x-3 gap-y-1 font-mono text-[12px]">
                  <span className="font-semibold text-gray-500">#</span>
                  <span className="text-right font-semibold text-gray-500">raw</span>
                  <span className="text-right font-semibold text-gray-500">clínico</span>
                  <span className="font-semibold text-gray-500">origen</span>
                  <span />
                  {points.map((p, i) => (
                    <PointRow key={p.id} index={i + 1} point={p} onRemove={() => removePoint(p.id)} />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPoints([])}
                  className="mt-2 text-[12px] text-gray-500 underline"
                >
                  Reset puntos
                </button>
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-gray-400">Sin puntos capturados todavía.</p>
            )}

            {/* Fit quality */}
            {fit.ok ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-lg bg-gray-50 p-2">
                  <span className="text-gray-500">R²</span>{' '}
                  <span className="font-mono font-semibold tabular-nums">
                    {fit.r2.toFixed(4)}
                  </span>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <span className="text-gray-500">Error máx.</span>{' '}
                  <span className="font-mono font-semibold tabular-nums">
                    {fit.maxError.toFixed(1)}°
                  </span>
                </div>
              </div>
            ) : points.length >= 2 ? (
              <p className="mt-3 rounded-lg bg-amber-50 p-2 text-[12px] text-amber-800">
                {fit.reason}
              </p>
            ) : null}

            <p className="mt-3 text-[12px] text-gray-600">
              Bloque para pegar en <code className="text-[11px]">JOINT_CALIBRATION</code>{' '}
              (sólo la entrada <strong>{targetJoint}</strong>):
            </p>
            <pre className="mt-1 overflow-auto rounded-lg bg-gray-900 p-3 text-[11px] leading-snug text-emerald-200">
              {json}
            </pre>
          </section>

          {/* Photo-based calibration */}
          <section className="mt-3 rounded-2xl border border-gray-200 bg-white p-4 text-[13px]">
            <h2 className="text-[14px] font-semibold">Calibración por foto</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-gray-600">
              Sube fotos de la mano <strong>de perfil</strong>, con el{' '}
              <strong>{targetConfig.label.toLowerCase()}</strong> completo y visible
              (igual que la medición en vivo: si no es de perfil, el ángulo no es
              comparable). Por cada foto verás el overlay de la {targetJoint}{' '}
              medida; escribe el ángulo clínico que anotó el cirujano y añádelo a
              los mismos puntos del ajuste.
            </p>
            <p className="mt-2 rounded-lg bg-blue-50 p-2 text-[12px] leading-relaxed text-blue-800">
              Las fotos se procesan para la selección actual (
              <strong>
                {targetConfig.label} · {targetJoint}
              </strong>
              ). Si cambias de dedo o de articulación, las fotos y los puntos se
              reinician.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  void handlePhotoFiles(e.target.files);
                  e.target.value = '';
                }}
                className="block w-full text-[12px] text-gray-700 file:mr-3 file:h-9 file:cursor-pointer file:rounded-xl file:border-0 file:bg-[#007AFF] file:px-4 file:text-[13px] file:font-semibold file:text-white"
              />
            </div>
            {processingPhotos ? (
              <p className="mt-2 text-[12px] text-gray-500">Procesando imágenes…</p>
            ) : null}

            {photos.length > 0 ? (
              <div className="mt-3 space-y-3">
                {photos.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    finger={targetConfig}
                    clinicalMax={clinicalMax}
                    onClinicalChange={(v) => setPhotoClinical(photo.id, v)}
                    onAddPoint={() => addPhotoPoint(photo.id)}
                    onRemove={() => removePhoto(photo.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-gray-400">Sin fotos subidas todavía.</p>
            )}
          </section>
        </aside>

        {/* Right: video + canvas */}
        <section className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
          />
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
          />
          {!running ? (
            <div className="absolute inset-0 flex items-center justify-center text-white/70">
              <p className="text-[14px]">Pulsa &quot;Iniciar cámara&quot; para empezar.</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

type FingerJointsRowProps = {
  label: string;
  angles: JointAngles | undefined;
  /** True for the finger under calibration. */
  highlightFinger: boolean;
  /** Joint under calibration: only that cell of the target finger is emphasised. */
  highlightJoint: TargetJoint;
};

/**
 * One row of the reference table. The emphasis marks the single cell that is
 * actually being calibrated (target finger × target joint) so the operator does
 * not read the wrong number off the grid.
 */
function FingerJointsRow({
  label,
  angles,
  highlightFinger,
  highlightJoint,
}: FingerJointsRowProps) {
  const cell = (v: number | undefined) =>
    typeof v === 'number' ? `${v.toFixed(1)}°` : '—';
  const rowClass = highlightFinger ? 'font-semibold text-[#007AFF]' : 'text-gray-700';
  return (
    <>
      <span className={rowClass}>{label}</span>
      {ALL_TARGET_JOINTS.map((joint) => {
        const isTargetCell = highlightFinger && joint === highlightJoint;
        return (
          <span
            key={joint}
            className={
              'text-right tabular-nums ' +
              (isTargetCell ? 'font-semibold text-[#007AFF]' : 'text-gray-400')
            }
          >
            {cell(angles?.[joint])}
          </span>
        );
      })}
    </>
  );
}

function PointRow({
  index,
  point,
  onRemove,
}: {
  index: number;
  point: CapturePoint;
  onRemove: () => void;
}) {
  const isPhoto = point.source === 'photo';
  return (
    <>
      <span className="text-gray-500">{index}</span>
      <span className="text-right tabular-nums text-gray-700">{point.raw.toFixed(1)}°</span>
      <span className="text-right tabular-nums text-gray-900">{point.clinical.toFixed(1)}°</span>
      <span
        className={
          'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ' +
          (isPhoto ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700')
        }
        title={`${isPhoto ? point.fileName : 'En vivo'} · quiralidad ${
          point.chirality ?? 'desconocida'
        }`}
      >
        {isPhoto ? 'foto' : 'vivo'}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="justify-self-end text-[12px] text-red-500 hover:text-red-700"
        aria-label={`Borrar punto ${index}`}
      >
        ✕
      </button>
    </>
  );
}

type PhotoCardProps = {
  photo: ProcessedPhoto;
  finger: FingerConfig;
  /** Clinical maximum of the joint, used only for the input placeholder. */
  clinicalMax: number;
  onClinicalChange: (value: string) => void;
  onAddPoint: () => void;
  onRemove: () => void;
};

function PhotoCard({
  photo,
  finger,
  clinicalMax,
  onClinicalChange,
  onAddPoint,
  onRemove,
}: PhotoCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render the image + joint overlay onto the card canvas (no mirror flip).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 320;
    const aspect = photo.imageH > 0 ? photo.imageW / photo.imageH : 4 / 3;
    const cssH = Math.round(cssW / (aspect || 4 / 3));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = `${cssH}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      if (cancelled) return;
      // Cover draw of the image to fill the canvas (mirrors toCanvasPx remap).
      const scale = Math.max(cssW / img.naturalWidth, cssH / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const offX = (cssW - drawW) / 2;
      const offY = (cssH - drawH) / 2;
      ctx.drawImage(img, offX, offY, drawW, drawH);

      // The overlay uses the photo's OWN joint, which is the one its raw angle
      // was computed for — never the current selector.
      if (photo.landmarks && photo.raw !== null) {
        drawJointOverlay(
          ctx,
          photo.landmarks,
          finger,
          photo.joint,
          photo.raw,
          cssW,
          cssH,
          photo.imageW,
          photo.imageH,
          false, // photos are not mirrored — draw text the normal way
        );
      }
    };
    img.src = photo.objectUrl;
    return () => {
      cancelled = true;
    };
  }, [
    photo.objectUrl,
    photo.landmarks,
    photo.raw,
    photo.joint,
    photo.imageW,
    photo.imageH,
    finger,
  ]);

  return (
    <div className="rounded-xl border border-gray-200 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12px] font-medium text-gray-700" title={photo.fileName}>
          {photo.fileName}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-[12px] text-red-500 hover:text-red-700"
          aria-label={`Quitar foto ${photo.fileName}`}
        >
          ✕
        </button>
      </div>

      {photo.error ? (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-[12px] text-red-700">{photo.error}</p>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            className="mt-2 w-full rounded-lg bg-black"
          />
          <div className="mt-2 flex items-end gap-2">
            <div className="rounded-lg bg-gray-50 px-2 py-1 text-center">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">
                {photo.joint} crudo
              </p>
              <p className="font-mono text-[15px] font-semibold tabular-nums text-gray-900">
                {photo.raw !== null ? `${photo.raw.toFixed(1)}°` : '—'}
              </p>
              <p className="text-[9px] uppercase tracking-wide text-gray-400">
                {photo.chirality ?? 'sin quiralidad'}
              </p>
            </div>
            <label className="flex-1">
              <span className="block text-[10px] text-gray-500">Ángulo clínico (°)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={photo.clinicalInput}
                onChange={(e) => onClinicalChange(e.target.value)}
                placeholder={`p.ej. 0, ${Math.round(clinicalMax / 2)}, ${clinicalMax}`}
                className="mt-1 h-9 w-full rounded-xl border border-gray-200 px-2 text-[13px] tabular-nums outline-none focus:border-[#007AFF]"
              />
            </label>
            <button
              type="button"
              disabled={photo.raw === null || photo.clinicalInput.trim() === ''}
              onClick={onAddPoint}
              className="h-9 rounded-xl bg-[#007AFF] px-3 text-[12px] font-semibold text-white disabled:bg-gray-200 disabled:text-gray-500"
            >
              Añadir punto
            </button>
          </div>
        </>
      )}
    </div>
  );
}
