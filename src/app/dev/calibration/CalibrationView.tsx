'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FINGERS,
  calculateAllJointAngles,
  calculateWristAngle,
  drawHand,
  normalizeJointAngle,
  DEFAULT_FINGER_STATUS,
  type FingerJointAngles,
  type FingerName,
  type JointAngles,
  type Point,
} from '@/lib/hand-tracking';

/**
 * Sanity tool for joint angle measurement (IA-04).
 *
 * Renders MediaPipe's HandLandmarker output at ~30 fps, exposes raw + normalized
 * MCP/PIP/DIP for every long finger, the wrist angle (with virtual forearm
 * projection), and a confidence indicator. Two reference captures (open / fist)
 * surface a copy-pasteable JSON block ready to substitute into JOINT_CALIBRATION.
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

const MEDIAPIPE_WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const LONG_FINGERS: FingerName[] = ['indice', 'medio', 'anular', 'menique'];

type ReferenceCapture = {
  /** Raw measured value (degrees) for each (finger, joint). */
  fingerJoints: Record<FingerName, JointAngles>;
  /** Raw wrist value. */
  wrist: number;
  /** ISO timestamp. */
  capturedAt: string;
};

type CalibrationDraft = {
  open: ReferenceCapture | null;
  fist: ReferenceCapture | null;
};

/**
 * Project a virtual forearm point opposite to middleMCP.
 * Mirrors what `calculateWristAngle` documents as the expected reference vector.
 * Length is arbitrary (vector-only consumer); 1 normalized-coord unit is plenty.
 */
function projectForearmPoint(landmarks: Point[]): Point {
  const wrist = landmarks[0];
  const middleMCP = landmarks[9];
  const dx = middleMCP.x - wrist.x;
  const dy = middleMCP.y - wrist.y;
  const dz = middleMCP.z - wrist.z;
  return { x: wrist.x - dx, y: wrist.y - dy, z: wrist.z - dz };
}

function pickHandedness(result: HandLandmarkerResult, idx: number): HandednessEntry | null {
  const arr = result.handedness ?? result.handednesses;
  return arr?.[idx]?.[0] ?? null;
}

function avgVisibility(landmarks: Array<{ visibility?: number }>): number | null {
  const vs = landmarks.map((l) => l.visibility).filter((v): v is number => typeof v === 'number');
  if (vs.length === 0) return null;
  return vs.reduce((a, b) => a + b, 0) / vs.length;
}

/**
 * Median across the long fingers — the value to drop into a `measured*` slot.
 * Median resists single-finger outliers (e.g. an injured finger that didn't
 * fully open during the capture).
 */
function medianAcrossFingers(per: Record<FingerName, JointAngles>, joint: keyof JointAngles): number {
  const values = LONG_FINGERS.map((f) => per[f]?.[joint]).filter((v): v is number => typeof v === 'number');
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function buildCalibrationJson(draft: CalibrationDraft): string {
  if (!draft.open || !draft.fist) {
    return '// Captura las dos referencias (mano abierta + puño) para generar el JSON.';
  }
  const out = {
    wrist: {
      measuredOpen: Math.round(Math.abs(draft.open.wrist) * 10) / 10,
      measuredClosed: Math.round(Math.abs(draft.fist.wrist) * 10) / 10,
      clinicalMax: 90,
      clinicalMin: -70,
    },
    MCP: {
      measuredOpen: Math.round(medianAcrossFingers(draft.open.fingerJoints, 'MCP') * 10) / 10,
      measuredClosed: Math.round(medianAcrossFingers(draft.fist.fingerJoints, 'MCP') * 10) / 10,
      clinicalMax: 90,
      clinicalMin: -30,
    },
    PIP: {
      measuredOpen: Math.round(medianAcrossFingers(draft.open.fingerJoints, 'PIP') * 10) / 10,
      measuredClosed: Math.round(medianAcrossFingers(draft.fist.fingerJoints, 'PIP') * 10) / 10,
      clinicalMax: 100,
    },
    DIP: {
      measuredOpen: Math.round(medianAcrossFingers(draft.open.fingerJoints, 'DIP') * 10) / 10,
      measuredClosed: Math.round(medianAcrossFingers(draft.fist.fingerJoints, 'DIP') * 10) / 10,
      clinicalMax: 80,
    },
  };
  return JSON.stringify(out, null, 2);
}

export function CalibrationView() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<HandLandmarkerInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // Live read-outs are kept in refs (mutated each frame) and surfaced to React
  // via a single `tick` counter so we don't re-render at 30Hz on every value.
  const liveFingerJointsRef = useRef<Record<FingerName, JointAngles> | null>(null);
  const liveWristRef = useRef<number>(0);
  const liveHandednessRef = useRef<{ label?: string; score?: number }>({});
  const liveVisibilityRef = useRef<number | null>(null);
  const liveDetectedRef = useRef<boolean>(false);

  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const showLandmarksRef = useRef(true);
  showLandmarksRef.current = showLandmarks;

  const [draft, setDraft] = useState<CalibrationDraft>({ open: null, fist: null });

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

  useEffect(() => () => stop(), [stop]);

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
      liveHandednessRef.current = {
        label: handedness?.categoryName,
        score: handedness?.score,
      };
      liveVisibilityRef.current = avgVisibility(hand);

      const all: FingerJointAngles = calculateAllJointAngles(hand);
      liveFingerJointsRef.current = all;

      const forearm = projectForearmPoint(hand);
      liveWristRef.current = calculateWristAngle(hand, forearm);

      if (showLandmarksRef.current) {
        const fingerAnglesForDraw = {
          pulgar: 0, indice: 0, medio: 0, anular: 0, menique: 0,
        };
        drawHand(
          ctx,
          hand,
          rect.width,
          rect.height,
          video.videoWidth || rect.width,
          video.videoHeight || rect.height,
          DEFAULT_FINGER_STATUS,
          fingerAnglesForDraw,
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

  const captureReference = useCallback((slot: 'open' | 'fist') => {
    if (!liveFingerJointsRef.current || !liveDetectedRef.current) return;
    const snapshot: ReferenceCapture = {
      fingerJoints: structuredClone(liveFingerJointsRef.current),
      wrist: liveWristRef.current,
      capturedAt: new Date().toISOString(),
    };
    setDraft((d) => ({ ...d, [slot]: snapshot }));
  }, []);

  const json = buildCalibrationJson(draft);
  void tick; // referenced to keep the hook chain reactive

  // ----- read-outs (computed each render from refs, ~10Hz) -----
  const live = liveFingerJointsRef.current;
  const handedness = liveHandednessRef.current;
  const visibility = liveVisibilityRef.current;
  const detected = liveDetectedRef.current;
  const lowConfidence = (handedness.score ?? 1) < 0.7;
  const lowVisibility = visibility !== null && visibility < 0.4;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 p-4 lg:flex-row">
        {/* Left: live read-out panel */}
        <aside className="w-full shrink-0 lg:w-[440px]">
          <header className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
              Dev tool
            </p>
            <h1 className="mt-1 text-[18px] font-semibold">Calibración (IA-04)</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
              Coloca la mano en posición conocida (recta sobre la mesa o puño
              cerrado) y captura la referencia. Compara con goniómetro real.
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
                <span>Handedness</span>
                <span>
                  {handedness.label ?? '—'}
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
                {lowConfidence ? 'Baja confianza handedness. ' : ''}
                Las medidas pueden no ser fiables.
              </p>
            ) : null}
          </section>

          {/* Per-joint live values */}
          <section className="mt-3 rounded-2xl border border-gray-200 bg-white p-4 text-[13px]">
            <h2 className="text-[14px] font-semibold">Ángulos en vivo</h2>
            <div className="mt-2 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 font-mono text-[12px]">
              <span className="font-semibold">Articulación</span>
              <span className="text-right font-semibold">crudo</span>
              <span className="text-right font-semibold">norm.</span>
              <span />

              <span>Wrist</span>
              <span className="text-right tabular-nums">{liveWristRef.current.toFixed(1)}°</span>
              <span className="text-right tabular-nums">
                {normalizeJointAngle(liveWristRef.current, 'wrist').toFixed(1)}°
              </span>
              <span />

              {LONG_FINGERS.map((name) => {
                const finger = FINGERS.find((f) => f.name === name)!;
                const angles = live?.[name];
                return (
                  <FingerRows
                    key={name}
                    label={finger.label}
                    angles={angles}
                  />
                );
              })}
            </div>
          </section>

          {/* Capture buttons */}
          <section className="mt-3 rounded-2xl border border-gray-200 bg-white p-4 text-[13px]">
            <h2 className="text-[14px] font-semibold">Capturar referencia</h2>
            <p className="mt-1 text-[12px] text-gray-600">
              Captura las dos posiciones extremas. Se mostrará el JSON listo
              para pegar en `JOINT_CALIBRATION`.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={!detected}
                onClick={() => captureReference('open')}
                className="h-9 flex-1 rounded-xl bg-emerald-600 px-3 text-[13px] font-semibold text-white disabled:bg-gray-200 disabled:text-gray-500"
              >
                {draft.open ? 'Abierta ✓' : 'Mano abierta'}
              </button>
              <button
                type="button"
                disabled={!detected}
                onClick={() => captureReference('fist')}
                className="h-9 flex-1 rounded-xl bg-orange-600 px-3 text-[13px] font-semibold text-white disabled:bg-gray-200 disabled:text-gray-500"
              >
                {draft.fist ? 'Puño ✓' : 'Puño cerrado'}
              </button>
            </div>
            {(draft.open || draft.fist) && (
              <button
                type="button"
                onClick={() => setDraft({ open: null, fist: null })}
                className="mt-2 text-[12px] text-gray-500 underline"
              >
                Reset capturas
              </button>
            )}
            <pre className="mt-3 max-h-[280px] overflow-auto rounded-lg bg-gray-900 p-3 text-[11px] leading-snug text-emerald-200">
              {json}
            </pre>
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

function FingerRows({
  label,
  angles,
}: {
  label: string;
  angles: JointAngles | undefined;
}) {
  const joints: Array<keyof JointAngles> = ['MCP', 'PIP', 'DIP'];
  return (
    <>
      {joints.map((j, i) => {
        const raw = angles?.[j];
        const norm = typeof raw === 'number' ? normalizeJointAngle(raw, j) : null;
        return (
          <RowFragment
            key={`${label}-${j}`}
            primary={i === 0 ? label : ''}
            joint={j}
            raw={raw}
            norm={norm}
          />
        );
      })}
    </>
  );
}

function RowFragment({
  primary,
  joint,
  raw,
  norm,
}: {
  primary: string;
  joint: string;
  raw: number | undefined;
  norm: number | null;
}) {
  return (
    <>
      <span className="text-gray-700">
        {primary ? <span className="font-semibold">{primary}</span> : <span className="opacity-0">·</span>}
      </span>
      <span className="text-right tabular-nums">{typeof raw === 'number' ? `${raw.toFixed(1)}°` : '—'}</span>
      <span className="text-right tabular-nums">{typeof norm === 'number' ? `${norm.toFixed(1)}°` : '—'}</span>
      <span className="pl-2 text-gray-500">{joint}</span>
    </>
  );
}
