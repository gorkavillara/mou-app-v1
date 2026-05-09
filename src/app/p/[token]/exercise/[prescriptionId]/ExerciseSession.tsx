'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera, CheckCircle2, RotateCcw } from 'lucide-react';
import {
  FINGERS,
  JOINT_CALIBRATION,
  calculateAllJointAngles,
  createRepCoaching,
  drawHand,
  normalizeJointAngle,
  readHandedness,
  summarizeHandednessSamples,
  updateRepCoaching,
  type FingerJointAngles,
  type FingerStatusMap,
  type HandednessReading,
  type JointAngles,
  type JointName,
  type Point,
  type RepCoachingState,
} from '@/lib/hand-tracking';
import type { TrackedJoint } from '@/lib/database.types';
import { ExerciseAnimation } from '@/components/exercise-animation';
import type {
  CreateSessionPayload,
  PatientPublic,
  PrescriptionPublic,
  RepMeasurementPayload,
} from '../../types';

/**
 * F-10 client component.
 *
 * Three-phase state machine:
 *   intro    → camera permission / "Empezar"
 *   running  → MediaPipe loop, angle overlay, rep counter
 *   done     → summary + POST to /api/patient/[token]/sessions
 *
 * The detection loop uses MediaPipe's HandLandmarker (CDN), running 21 landmarks
 * per frame. Reps are driven by the average normalized MCP across the tracked
 * fingers — for the seeded exercises both flexion-passive and extension-active
 * pivot on MCP and MCP is always present in `tracked_joints`. PIP/DIP are still
 * captured per-rep (peaks) and reported alongside.
 *
 * "low_visibility" rep flag: if MediaPipe loses the hand for more than 30% of
 * the frames recorded during a single rep, that rep's measurements get
 * `quality_flag: 'low_visibility'` so the doctor knows not to trust the peaks.
 */

type Phase = 'intro' | 'running' | 'done';

type Props = {
  token: string;
  patient: PatientPublic;
  prescription: PrescriptionPublic;
};

// MediaPipe types — kept narrow on purpose (no `any`).
// Both `handedness` and `handednesses` are listed because the field name
// has shifted across @mediapipe/tasks-vision releases. `readHandedness`
// reads whichever one is populated.
type HandLandmarkerResult = {
  landmarks?: Array<Array<{ x: number; y: number; z: number }>>;
  handedness?: Array<Array<{ categoryName?: string; score?: number }>>;
  handednesses?: Array<Array<{ categoryName?: string; score?: number }>>;
};

type HandLandmarkerInstance = {
  detectForVideo: (video: HTMLVideoElement, ts: number) => HandLandmarkerResult;
  close?: () => void;
};

const MEDIAPIPE_WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Rep counting tuning (clinical degrees on the normalized scale).
const REP_FLEXION_THRESHOLD = 35; // entering "flexion" zone
const REP_EXTENSION_THRESHOLD = 10; // returning to "open" zone
const SMOOTHING_WINDOW = 8;
// Separate smoothing window for the on-screen indicator (F-13). Smaller than
// the rep-counter window so the displayed value tracks motion responsively
// without affecting the rep detection logic.
const DISPLAY_SMOOTHING_WINDOW = 5;
// React state flush interval for the indicator. The rAF loop fills refs at
// ~30 fps; we sample those refs into state here so the UI doesn't re-render
// every frame.
const DISPLAY_FLUSH_MS = 150;

// All fingers normal — patient view doesn't expose finger-status overrides.
const ALL_NORMAL: FingerStatusMap = {
  pulgar: 'normal',
  indice: 'normal',
  medio: 'normal',
  anular: 'normal',
  menique: 'normal',
};

type RepRecord = {
  rep_index: number;
  perJoint: Partial<Record<TrackedJoint, { peakFlex: number; peakExt: number }>>;
  framesTotal: number;
  framesMissing: number;
};

function jointFromTracked(joint: TrackedJoint): JointName {
  // The 4 enum values overlap 1:1 with the lib's JointName.
  return joint as JointName;
}

function pickFingerForRep(targetFinger: PrescriptionPublic['exercise'] extends infer T ?
  T extends { target_finger: infer F } ? F : never : never): typeof FINGERS[number]['name'] | 'all' {
  switch (targetFinger) {
    case 'thumb': return 'pulgar';
    case 'index': return 'indice';
    case 'middle': return 'medio';
    case 'ring': return 'anular';
    case 'pinky': return 'menique';
    case 'all':
    default:
      return 'all';
  }
}

export function ExerciseSession({ token, prescription, patient }: Props) {
  void patient; // patient ID is anonymous; available if we later want to render it
  const exercise = prescription.exercise!;
  const targetReps = prescription.sets * prescription.reps_per_set;
  const trackedJoints = exercise.tracked_joints;
  const driverFinger = pickFingerForRep(exercise.target_finger);

  const [phase, setPhase] = useState<Phase>('intro');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [repCount, setRepCount] = useState(0);
  // IA-11 — expected hand for this session. We have no DB column yet that
  // tells us which side was operated; the intro phase exposes a toggle so the
  // patient can flip it before starting. Default to right.
  const [expectedHand, setExpectedHand] = useState<'Left' | 'Right'>('Right');
  // IA-09/IA-11 — single-toast queue. We keep it as a "current toast" string
  // (or null) plus a numeric key so re-firing the same text re-triggers the
  // dismiss timer.
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  // F-13 display state. Updated via the flush interval, not per frame.
  const [liveAngle, setLiveAngle] = useState(0);
  const [livePeak, setLivePeak] = useState(0);
  const [livePerJoint, setLivePerJoint] = useState<Partial<Record<TrackedJoint, number>>>({});
  const [submitState, setSubmitState] = useState<'idle' | 'pending' | 'ok' | 'error'>('idle');
  const [summary, setSummary] = useState<{
    perJoint: Partial<Record<TrackedJoint, { avgFlex: number; avgExt: number }>>;
    repsCompleted: number;
  } | null>(null);

  // Refs that need to live across rAF iterations.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<HandLandmarkerInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<string | null>(null);

  // Rep tracking ref state (not driving renders directly — we sample to UI refs).
  const repCountRef = useRef(0);
  const directionRef = useRef<'open' | 'flexed' | null>(null);
  const angleHistoryRef = useRef<number[]>([]);
  const currentRepRef = useRef<RepRecord>({
    rep_index: 0,
    perJoint: {},
    framesTotal: 0,
    framesMissing: 0,
  });
  const repHistoryRef = useRef<RepRecord[]>([]);

  // IA-09 — coaching state for "rep mal hecha". Lives in a ref because the
  // rAF loop closes a rep without rerendering. We update via the pure helper
  // so the logic is testable in isolation.
  const repCoachingRef = useRef<RepCoachingState>(createRepCoaching());

  // IA-11 — handedness sampler. We collect the first N readings where a hand
  // was detected, summarize once, fire one toast if mismatched, and stop.
  const HANDEDNESS_SAMPLE_TARGET = 5;
  const HANDEDNESS_MIN_SCORE = 0.7;
  const handednessSamplesRef = useRef<HandednessReading[]>([]);
  const handednessFiredRef = useRef(false);
  const expectedHandRef = useRef<'Left' | 'Right'>('Right');

  // Keep the ref in sync with the state so the rAF callbacks see the latest
  // toggle value without rebinding the loop.
  useEffect(() => {
    expectedHandRef.current = expectedHand;
  }, [expectedHand]);

  // F-13 display refs. Updated every frame; sampled into state every
  // `DISPLAY_FLUSH_MS` so we don't re-render the React tree per frame.
  const displayHistoryRef = useRef<number[]>([]);
  const displayAngleRef = useRef(0);
  const displayPeakRef = useRef(0);
  const displayPerJointRef = useRef<Partial<Record<TrackedJoint, number>>>({});

  // Show a transient toast. Subsequent calls cancel the previous timer so we
  // never stack timers on top of one another.
  const showToast = useCallback((text: string, ms = 3000) => {
    const id = Date.now();
    setToast({ id, text });
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast((t) => (t && t.id === id ? null : t));
      toastTimerRef.current = null;
    }, ms);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const teardown = useCallback(() => {
    stopLoop();
    stopStream();
    try {
      landmarkerRef.current?.close?.();
    } catch {
      // ignore
    }
    landmarkerRef.current = null;
  }, [stopLoop, stopStream]);

  // Cleanup on unmount.
  useEffect(() => () => teardown(), [teardown]);

  // F-13 — periodic flush of display refs into state. Only runs while the
  // session is in the `running` phase. We schedule via setInterval so it's
  // independent of the rAF cadence; if the browser supports
  // `requestIdleCallback` the cost is even smaller, but setInterval is
  // sufficient at 150ms.
  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => {
      const angle = Math.round(displayAngleRef.current);
      const peak = Math.round(displayPeakRef.current);
      // Snapshot per-joint values; rounding here so equality checks below are
      // cheap and we avoid spurious re-renders from floating noise.
      const next: Partial<Record<TrackedJoint, number>> = {};
      for (const joint of trackedJoints) {
        const v = displayPerJointRef.current[joint];
        if (v != null) next[joint] = Math.round(v);
      }
      setLiveAngle((prev) => (prev === angle ? prev : angle));
      setLivePeak((prev) => (prev === peak ? prev : peak));
      setLivePerJoint((prev) => {
        // Only update if at least one entry changed; cheap shallow check.
        let changed = false;
        for (const joint of trackedJoints) {
          if ((prev[joint] ?? null) !== (next[joint] ?? null)) { changed = true; break; }
        }
        return changed ? next : prev;
      });
    }, DISPLAY_FLUSH_MS);
    return () => window.clearInterval(id);
  }, [phase, trackedJoints]);

  // Pause loop when tab is hidden.
  useEffect(() => {
    function onVisibility() {
      if (document.hidden) {
        stopLoop();
      } else if (phase === 'running' && landmarkerRef.current && videoRef.current) {
        scheduleNextFrame();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
    // scheduleNextFrame is defined later in this scope; eslint disabled because
    // we intentionally don't want to recreate this listener on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stopLoop]);

  // ---------- per-frame loop ----------
  const processLandmarks = useCallback(
    (landmarks: Point[] | null) => {
      const rec = currentRepRef.current;
      rec.framesTotal += 1;
      if (!landmarks) {
        rec.framesMissing += 1;
        return;
      }

      const allRaw: FingerJointAngles = calculateAllJointAngles(landmarks);

      // Decide which fingers contribute to the rep driver and to per-joint peaks.
      const fingers =
        driverFinger === 'all'
          ? FINGERS.filter((f) => f.name !== 'pulgar') // long fingers
          : FINGERS.filter((f) => f.name === driverFinger);

      // Collect normalized angles per tracked joint.
      const perJointSamples: Partial<Record<TrackedJoint, number[]>> = {};
      for (const joint of trackedJoints) {
        if (joint === 'wrist') continue; // wrist not driven by finger landmarks here
        const jn = jointFromTracked(joint);
        const samples: number[] = [];
        for (const f of fingers) {
          const raw: JointAngles = allRaw[f.name];
          const value =
            jn === 'MCP' ? raw.MCP : jn === 'PIP' ? raw.PIP : raw.DIP;
          samples.push(normalizeJointAngle(value, jn));
        }
        perJointSamples[joint] = samples;
      }

      // Update per-rep peaks per joint.
      for (const joint of trackedJoints) {
        const samples = perJointSamples[joint];
        if (!samples || samples.length === 0) continue;
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        const slot = rec.perJoint[joint] ?? { peakFlex: 0, peakExt: 0 };
        if (avg > 0) slot.peakFlex = Math.max(slot.peakFlex, Math.round(avg));
        if (avg < 0) slot.peakExt = Math.max(slot.peakExt, Math.round(Math.abs(avg)));
        rec.perJoint[joint] = slot;
      }

      // Driver: prefer MCP if available; otherwise the first tracked joint.
      const driverJoint: TrackedJoint =
        trackedJoints.find((j) => j === 'MCP') ?? trackedJoints[0];
      const driverSamples = perJointSamples[driverJoint] ?? [];
      const driverAvg =
        driverSamples.length > 0
          ? driverSamples.reduce((a, b) => a + b, 0) / driverSamples.length
          : 0;

      // Smoothing window for rep detection (heavier — 8 frames).
      const hist = angleHistoryRef.current;
      hist.push(driverAvg);
      if (hist.length > SMOOTHING_WINDOW) hist.shift();
      const smoothed = hist.reduce((a, b) => a + b, 0) / hist.length;

      // Display smoothing (lighter — 5 frames). Independent so UI tracks
      // motion responsively without slowing rep edges.
      const dispHist = displayHistoryRef.current;
      dispHist.push(driverAvg);
      if (dispHist.length > DISPLAY_SMOOTHING_WINDOW) dispHist.shift();
      const displaySmoothed = dispHist.reduce((a, b) => a + b, 0) / dispHist.length;
      displayAngleRef.current = displaySmoothed;
      const absDisplay = Math.abs(displaySmoothed);
      if (absDisplay > displayPeakRef.current) displayPeakRef.current = absDisplay;

      // Per-joint display values: average smoothing per joint isn't needed
      // (these are already averaged across fingers). We just write the
      // latest sample.
      for (const joint of trackedJoints) {
        const samples = perJointSamples[joint];
        if (!samples || samples.length === 0) continue;
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        displayPerJointRef.current[joint] = avg;
      }

      // Rep edge detection: only count once flexion threshold is crossed,
      // then we wait for a return to the open zone before counting.
      if (smoothed >= REP_FLEXION_THRESHOLD) {
        directionRef.current = 'flexed';
      } else if (
        smoothed <= REP_EXTENSION_THRESHOLD &&
        directionRef.current === 'flexed'
      ) {
        // Completed one rep cycle (open → flex → open).
        const completed = { ...rec, rep_index: repCountRef.current };
        repHistoryRef.current.push(completed);
        repCountRef.current += 1;
        setRepCount(repCountRef.current);

        // Reset rolling rep record.
        currentRepRef.current = {
          rep_index: repCountRef.current,
          perJoint: {},
          framesTotal: 0,
          framesMissing: 0,
        };
        directionRef.current = 'open';
        // Reset the displayed "peak this rep" so the indicator resets too.
        displayPeakRef.current = 0;

        if (repCountRef.current >= targetReps) {
          finishSession();
        }
      } else if (directionRef.current === null) {
        directionRef.current = 'open';
      }
    },
    // finishSession defined below; eslint disabled for the same reason as above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [driverFinger, targetReps, trackedJoints],
  );

  const renderFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const lm = landmarkerRef.current;
    if (!video || !canvas || !lm) {
      scheduleNextFrame();
      return;
    }

    if (video.readyState < 2) {
      scheduleNextFrame();
      return;
    }

    const result = lm.detectForVideo(video, performance.now());
    const hand = result.landmarks?.[0] ?? null;

    // Resize canvas to match its on-screen size for crisp rendering.
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== rect.width * dpr) canvas.width = rect.width * dpr;
    if (canvas.height !== rect.height * dpr) canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      scheduleNextFrame();
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (hand) {
      const fingerAngles = {
        pulgar: 0, indice: 0, medio: 0, anular: 0, menique: 0,
      };
      drawHand(
        ctx,
        hand,
        rect.width,
        rect.height,
        video.videoWidth || rect.width,
        video.videoHeight || rect.height,
        ALL_NORMAL,
        fingerAngles,
      );
      processLandmarks(hand);
    } else {
      processLandmarks(null);
    }

    scheduleNextFrame();
  }, [processLandmarks]);

  const scheduleNextFrame = useCallback(() => {
    rafRef.current = requestAnimationFrame(renderFrame);
  }, [renderFrame]);

  // ---------- transitions ----------
  const finishSession = useCallback(() => {
    if (phase !== 'running') return;
    stopLoop();

    // Aggregate per-joint averages across all completed reps.
    const reps = repHistoryRef.current;
    const perJoint: Partial<Record<TrackedJoint, { avgFlex: number; avgExt: number }>> = {};
    for (const joint of trackedJoints) {
      const samplesFlex: number[] = [];
      const samplesExt: number[] = [];
      for (const r of reps) {
        const slot = r.perJoint[joint];
        if (!slot) continue;
        samplesFlex.push(slot.peakFlex);
        samplesExt.push(slot.peakExt);
      }
      perJoint[joint] = {
        avgFlex: samplesFlex.length
          ? Math.round(samplesFlex.reduce((a, b) => a + b, 0) / samplesFlex.length)
          : 0,
        avgExt: samplesExt.length
          ? Math.round(samplesExt.reduce((a, b) => a + b, 0) / samplesExt.length)
          : 0,
      };
    }

    setSummary({ perJoint, repsCompleted: repHistoryRef.current.length });
    setPhase('done');
  }, [phase, stopLoop, trackedJoints]);

  // POST when entering "done".
  useEffect(() => {
    if (phase !== 'done' || submitState !== 'idle') return;
    void submitSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const submitSession = useCallback(async () => {
    setSubmitState('pending');
    const reps = repHistoryRef.current;

    const measurements: RepMeasurementPayload[] = [];
    for (const r of reps) {
      const lowVisibility = r.framesTotal > 0 && r.framesMissing / r.framesTotal > 0.3;
      for (const joint of trackedJoints) {
        const slot = r.perJoint[joint];
        if (!slot) continue;
        measurements.push({
          rep_index: r.rep_index,
          joint,
          max_flexion_deg: slot.peakFlex || null,
          max_extension_deg: slot.peakExt || null,
          quality_flag: lowVisibility ? 'low_visibility' : 'clean',
        });
      }
    }

    const body: CreateSessionPayload = {
      prescription_id: prescription.id,
      started_at: startedAtRef.current ?? new Date().toISOString(),
      ended_at: new Date().toISOString(),
      reps_completed: reps.length,
      target_reps: targetReps,
      rep_measurements: measurements,
      client_metadata: {
        user_agent: navigator.userAgent,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        device_pixel_ratio: window.devicePixelRatio || 1,
      },
    };

    try {
      const res = await fetch(
        `/api/patient/${encodeURIComponent(token)}/sessions`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitState('ok');
    } catch (err) {
      console.error('[ExerciseSession] submit failed', err);
      setSubmitState('error');
    }
  }, [prescription.id, targetReps, token, trackedJoints]);

  const startSession = useCallback(async () => {
    setPermissionError(null);

    // 1. Camera.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
    } catch (err) {
      const e = err as { name?: string };
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        setPermissionError(
          'No has dado permiso a la cámara. Habilítala en los ajustes del navegador.',
        );
      } else if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') {
        setPermissionError(
          'No detectamos ninguna cámara en este dispositivo.',
        );
      } else {
        setPermissionError('No se ha podido iniciar la cámara.');
      }
      return;
    }

    // 2. Switch to running so the <video> renders, then attach the stream.
    setPhase('running');
    startedAtRef.current = new Date().toISOString();

    // Wait one frame so the <video> mounts.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const video = videoRef.current;
    if (video && streamRef.current) {
      video.srcObject = streamRef.current;
      try {
        await video.play();
      } catch {
        // iOS Safari: play() may reject if not strictly user-gestured. The
        // gesture is the "Empezar" tap, which should satisfy it; if it still
        // throws we surface a soft message and fall back.
      }
    }

    // 3. MediaPipe.
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(
        MEDIAPIPE_WASM_URL,
      );
      const landmarker = (await vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: HAND_LANDMARKER_MODEL_URL,
          delegate: 'GPU',
        },
        numHands: 1,
        runningMode: 'VIDEO',
      })) as unknown as HandLandmarkerInstance;
      landmarkerRef.current = landmarker;
    } catch (err) {
      console.error('[ExerciseSession] MediaPipe init failed', err);
      // Try CPU fallback.
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const fileset = await vision.FilesetResolver.forVisionTasks(
          MEDIAPIPE_WASM_URL,
        );
        const landmarker = (await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: HAND_LANDMARKER_MODEL_URL,
            delegate: 'CPU',
          },
          numHands: 1,
          runningMode: 'VIDEO',
        })) as unknown as HandLandmarkerInstance;
        landmarkerRef.current = landmarker;
      } catch (err2) {
        console.error('[ExerciseSession] MediaPipe CPU init failed', err2);
        setPermissionError(
          'No hemos podido cargar el detector de mano. Comprueba tu conexión.',
        );
        teardown();
        setPhase('intro');
        return;
      }
    }

    // 4. Start rAF loop.
    repCountRef.current = 0;
    repHistoryRef.current = [];
    angleHistoryRef.current = [];
    directionRef.current = null;
    currentRepRef.current = {
      rep_index: 0,
      perJoint: {},
      framesTotal: 0,
      framesMissing: 0,
    };
    displayHistoryRef.current = [];
    displayAngleRef.current = 0;
    displayPeakRef.current = 0;
    displayPerJointRef.current = {};
    setRepCount(0);
    setLiveAngle(0);
    setLivePeak(0);
    setLivePerJoint({});
    scheduleNextFrame();
  }, [scheduleNextFrame, teardown]);

  const handleEnd = useCallback(() => finishSession(), [finishSession]);

  // ---------- render ----------
  const driverJoint: TrackedJoint =
    trackedJoints.find((j) => j === 'MCP') ?? trackedJoints[0];

  // Clinical max for the driver joint, used to fill the horizontal bar.
  // `wrist` shares the same calibration record but isn't driven by finger
  // landmarks here; we still fall back to 90° to avoid a divide-by-zero.
  const driverClinicalMax =
    driverJoint === 'wrist'
      ? JOINT_CALIBRATION.wrist.clinicalMax
      : driverJoint === 'PIP'
        ? JOINT_CALIBRATION.PIP.clinicalMax
        : driverJoint === 'DIP'
          ? JOINT_CALIBRATION.DIP.clinicalMax
          : JOINT_CALIBRATION.MCP.clinicalMax;
  const positiveFillPct =
    liveAngle > 0
      ? Math.min(100, (liveAngle / Math.max(1, driverClinicalMax)) * 100)
      : 0;
  // For hyperextension we render a small red sliver pointing left. We use the
  // joint's `clinicalMin` (when defined) as the negative scale.
  const negativeMin =
    driverJoint === 'wrist'
      ? Math.abs(JOINT_CALIBRATION.wrist.clinicalMin ?? 0)
      : driverJoint === 'MCP'
        ? Math.abs(JOINT_CALIBRATION.MCP.clinicalMin ?? 0)
        : 0;
  const negativeFillPct =
    liveAngle < 0 && negativeMin > 0
      ? Math.min(100, (Math.abs(liveAngle) / negativeMin) * 100)
      : 0;
  const showJointStrip = trackedJoints.length > 1;

  if (phase === 'intro') {
    return (
      <main className="min-h-screen bg-[#F2F2F7]">
        <div className="mx-auto w-full max-w-[520px] px-5 pt-6 pb-12">
          <Link
            href={`/p/${token}`}
            className="inline-flex items-center gap-1 text-[15px] text-[#007AFF]"
          >
            <ArrowLeft size={18} aria-hidden /> Volver
          </Link>
          <section className="mt-10">
            <p className="text-[13px] font-medium uppercase tracking-wider text-[#007AFF]">
              Ejercicio
            </p>
            <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-tight">
              {targetReps} repeticiones de {exercise.name}
            </h1>
            {exercise.description ? (
              <p className="mt-4 text-[16px] leading-relaxed text-gray-600">
                {exercise.description}
              </p>
            ) : null}
          </section>
          <section className="mt-8 rounded-2xl border border-gray-100 bg-white p-5">
            <h2 className="text-[15px] font-semibold text-gray-900">
              Antes de empezar
            </h2>
            <ul className="mt-3 space-y-2 text-[14px] text-gray-600">
              <li>• Coloca el móvil estable, a unos 30–40 cm de tu mano.</li>
              <li>• Asegúrate de tener buena luz frontal.</li>
              <li>• Apoya el antebrazo sobre la mesa para que la imagen no tiemble.</li>
            </ul>
          </section>
          {permissionError ? (
            <div
              role="alert"
              data-testid="camera-error"
              className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-[14px] text-red-700"
            >
              {permissionError}
            </div>
          ) : null}
          <button
            type="button"
            data-testid="start-exercise"
            onClick={startSession}
            className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#007AFF] text-[18px] font-semibold text-white active:bg-[#005BB5]"
          >
            <Camera size={20} strokeWidth={2.4} aria-hidden /> Empezar
          </button>
        </div>
      </main>
    );
  }

  if (phase === 'running') {
    return (
      <main className="relative min-h-screen w-full overflow-hidden bg-black text-white">
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

        {/* HUD */}
        <div className="relative z-10 flex h-screen flex-col">
          <div className="px-5 pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-2xl bg-black/50 px-4 py-3 backdrop-blur">
                <div className="text-[12px] uppercase tracking-wider text-white/70">
                  Repeticiones
                </div>
                <div className="mt-0.5 text-[28px] font-semibold leading-none">
                  <span data-testid="rep-counter">{repCount}</span>
                  <span className="text-white/60"> / {targetReps}</span>
                </div>
              </div>

              {/* F-13 — live angle indicator overlay (top-right). Frosted */}
              {/* white panel so it reads against camera background regardless */}
              {/* of skin tone or lighting. */}
              <div
                data-testid="live-angle"
                className="rounded-2xl bg-white/70 px-4 py-3 text-gray-900 backdrop-blur shadow-lg"
              >
                <div className="text-[11px] uppercase tracking-wider text-gray-500">
                  Ángulo actual
                </div>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span
                    data-testid="live-angle-value"
                    className="text-[26px] font-semibold tabular-nums leading-none"
                  >
                    {liveAngle}°
                  </span>
                  <span className="text-[11px] font-medium text-gray-500">
                    {driverJoint}
                  </span>
                </div>
                <div className="relative mt-2 h-1.5 w-36 overflow-hidden rounded-full bg-gray-200">
                  {/* Positive (flexion) fill — blue, grows rightward from center. */}
                  <div
                    className="absolute left-1/2 top-0 h-full rounded-r-full bg-[#007AFF] transition-[width] duration-150"
                    style={{ width: `${positiveFillPct / 2}%` }}
                  />
                  {/* Negative (hyperextension) sliver — red, grows leftward from center. */}
                  <div
                    className="absolute right-1/2 top-0 h-full rounded-l-full bg-[#FF3B30] transition-[width] duration-150"
                    style={{ width: `${negativeFillPct / 2}%` }}
                  />
                  {/* Center tick. */}
                  <div className="absolute left-1/2 top-0 h-full w-px -translate-x-px bg-gray-400/60" />
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  Pico de esta repetición:{' '}
                  <span className="font-semibold text-gray-700 tabular-nums">
                    {livePeak}°
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleEnd}
                className="rounded-full bg-white/20 px-4 py-2 text-[14px] font-semibold backdrop-blur active:bg-white/30"
              >
                Terminar
              </button>
            </div>
          </div>

          {/* F-13 — per-joint mini bars. Compact vertical strip on the right */}
          {/* edge of the video, one bar per tracked joint. No numbers — just */}
          {/* shape. Only rendered when tracked_joints.length > 1. */}
          {showJointStrip ? (
            <div
              data-testid="joint-strip"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 rounded-2xl bg-white/70 px-2 py-3 shadow-lg backdrop-blur"
            >
              {trackedJoints.map((joint) => {
                const max = JOINT_CALIBRATION[joint as JointName].clinicalMax;
                const value = livePerJoint[joint] ?? 0;
                const pct = Math.max(0, Math.min(100, (Math.abs(value) / Math.max(1, max)) * 100));
                return (
                  <div
                    key={joint}
                    className="flex flex-col items-center gap-1"
                    data-joint={joint}
                  >
                    <div className="text-[9px] font-medium uppercase tracking-wider text-gray-500">
                      {joint}
                    </div>
                    <div className="relative h-16 w-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="absolute bottom-0 left-0 w-full rounded-full bg-[#007AFF] transition-[height] duration-150"
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  // phase === 'done'
  const repsCompleted = summary?.repsCompleted ?? 0;
  return (
    <main className="min-h-screen bg-[#F2F2F7]">
      <div className="mx-auto w-full max-w-[520px] px-5 pt-12 pb-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#34C759]/10 text-[#34C759]">
          <CheckCircle2 size={36} strokeWidth={2.2} aria-hidden />
        </div>
        <h1 className="mt-6 text-[28px] font-semibold tracking-tight">
          Sesión terminada
        </h1>
        <p className="mt-2 text-[15px] text-gray-600">
          {repsCompleted} de {targetReps} repeticiones detectadas.
        </p>

        {summary ? (
          <section className="mt-8 rounded-2xl border border-gray-100 bg-white p-5 text-left">
            <h2 className="text-[15px] font-semibold">Pico medio por articulación</h2>
            <ul className="mt-3 space-y-2 text-[14px] text-gray-700">
              {trackedJoints.map((joint) => {
                const slot = summary.perJoint[joint];
                return (
                  <li key={joint} className="flex items-center justify-between">
                    <span className="font-medium">{joint}</span>
                    <span className="tabular-nums text-gray-600">
                      flex {slot?.avgFlex ?? 0}° · ext {slot?.avgExt ?? 0}°
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="mt-6 min-h-[40px]" data-testid="submit-state">
          {submitState === 'pending' ? (
            <p className="text-[14px] text-gray-500">Guardando datos…</p>
          ) : null}
          {submitState === 'ok' ? (
            <p className="inline-flex items-center gap-2 text-[14px] font-medium text-[#34C759]">
              <CheckCircle2 size={16} aria-hidden /> Datos guardados
            </p>
          ) : null}
          {submitState === 'error' ? (
            <div className="space-y-2">
              <p className="text-[14px] text-red-600">
                No pudimos guardar la sesión, vuelve a intentarlo.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitState('idle');
                  void submitSession();
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-[13px] font-medium text-gray-700"
              >
                <RotateCcw size={14} aria-hidden /> Reintentar
              </button>
            </div>
          ) : null}
        </div>

        <Link
          href={`/p/${token}`}
          className="mt-10 flex h-12 w-full items-center justify-center rounded-2xl bg-[#007AFF] text-[17px] font-semibold text-white"
        >
          Volver a inicio
        </Link>
      </div>
    </main>
  );
}
