'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
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
  type FingerName,
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
 * Four-phase state machine:
 *   intro     → camera permission / "Empezar"
 *   preparing → camera being acquired + model loading, spinner + live <video>
 *   running   → MediaPipe loop, angle overlay, rep counter
 *   done      → summary + POST to /api/patient/[token]/sessions
 *
 * BUG-1 (surgeon, 2026-05-20): on the FIRST session every time, on two
 * different phones, the screen went black and the patient had to exit and
 * re-enter for the camera to show. Root cause: the <video> element only
 * existed in the `running` phase, so the gesture handler requested the stream,
 * THEN flipped to `running`, THEN waited a rAF for the element to mount before
 * assigning `srcObject` + calling `play()` — by which point the iOS Safari
 * user-gesture context was already gone, so `play()` silently rejected and the
 * black <video> never started. MediaPipe was also loaded AFTER the camera,
 * serializing seconds of WASM fetch behind a dead-looking screen.
 *
 * The fix: a dedicated `preparing` phase that renders the <video> (and a
 * spinner) BEFORE we touch the camera, assigns the stream via a callback ref so
 * the element is guaranteed to exist, calls `play()` immediately, retries once
 * on `loadedmetadata`, loads the model in PARALLEL, and runs a ~4s watchdog
 * that surfaces an in-place "Reintentar" button (no exit/re-enter needed).
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

// UX-2 (surgeon, 2026-05-20): the session is run SERIES by SERIES. The counter
// must read "1/20" per set, pause between sets (`resting`), then resume at 1/20
// — never a single "1/100". `resting` keeps the camera stream alive but stops
// the rAF loop and the rep counter until the patient taps "Empezar serie n".
type Phase = 'intro' | 'preparing' | 'running' | 'resting' | 'done';

// Watchdog: if no decodable video frame arrives within this window we assume
// the camera is stuck (the surgeon's black-screen case) and offer a retry.
const CAMERA_WATCHDOG_MS = 4000;

// UX-4: human labels for the operated finger (capitalized, Spanish).
const FINGER_LABELS: Record<FingerName, string> = {
  pulgar: 'Pulgar',
  indice: 'Índice',
  medio: 'Medio',
  anular: 'Anular',
  menique: 'Meñique',
};

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
  const exercise = prescription.exercise!;
  const sets = Math.max(1, prescription.sets);
  const repsPerSet = Math.max(1, prescription.reps_per_set);
  const targetReps = sets * repsPerSet;
  const trackedJoints = exercise.tracked_joints;

  // FB-1: measurement driver. If the patient has ≥1 injured finger, the
  // measurement is the AVERAGE across all injured fingers (and `drawHand`
  // paints them orange). Otherwise we fall back to the exercise's
  // `target_finger` selection (e.g. the long fingers for "all"), EXCLUDING any
  // amputated finger. Amputated fingers are NEVER part of the driver set.
  const injuredFingers = useMemo(
    () => patient.injured_fingers ?? [],
    [patient.injured_fingers],
  );
  const amputatedFingers = useMemo(
    () => patient.amputated_fingers ?? [],
    [patient.amputated_fingers],
  );

  // The set of fingers whose angles drive the rep counter + per-joint peaks.
  // - ≥1 injured → exactly those fingers.
  // - else → the target_finger selection minus amputated. For "all" this is
  //   the long fingers (thumb stays out, as today); a single named target that
  //   happens to be amputated yields an empty set (no measurable finger).
  const driverFingerNames: FingerName[] = useMemo(() => {
    if (injuredFingers.length > 0) return injuredFingers;
    const target = pickFingerForRep(exercise.target_finger);
    const base: FingerName[] =
      target === 'all'
        ? FINGERS.map((f) => f.name).filter((n) => n !== 'pulgar')
        : [target];
    return base.filter((n) => !amputatedFingers.includes(n));
  }, [injuredFingers, amputatedFingers, exercise.target_finger]);

  // Label shown while running: explicit when we're measuring a specific set of
  // injured fingers, null when falling back to the whole "all" selection (so
  // we don't clutter the HUD with every long finger).
  const measuringLabel =
    injuredFingers.length > 0
      ? injuredFingers.map((f) => FINGER_LABELS[f]).join(', ')
      : driverFingerNames.length === 1
        ? FINGER_LABELS[driverFingerNames[0]]
        : null;

  // FB-1: finger status map for `drawHand`. Injured → orange, amputated →
  // dashed gray, rest normal. Memoized so the rAF loop closure keeps a stable
  // identity across renders.
  const fingerStatus: FingerStatusMap = useMemo(() => {
    const map: FingerStatusMap = { ...ALL_NORMAL };
    for (const f of injuredFingers) map[f] = 'injured';
    for (const f of amputatedFingers) map[f] = 'amputated';
    return map;
  }, [injuredFingers, amputatedFingers]);

  // UX-2: spelled-out dose for the intro (matches PatientHome wording).
  const doseSentence = (() => {
    const seriesWord = sets === 1 ? 'serie' : 'series';
    const repWord = repsPerSet === 1 ? 'repetición' : 'repeticiones';
    const timesWord =
      prescription.sessions_per_day === 1 ? 'vez al día' : 'veces al día';
    return `${sets} ${seriesWord} de ${repsPerSet} ${repWord}, ${prescription.sessions_per_day} ${timesWord}`;
  })();

  const [phase, setPhase] = useState<Phase>('intro');
  // Review follow-up (2026-05-20): `finishSession` is captured by the
  // memoized rAF pipeline (`processLandmarks` → `renderFrame`), which is
  // created while phase is still 'intro'. Guarding on the `phase` state
  // inside that stale closure made the guard see 'intro' forever, so a
  // session that reached its rep target never transitioned to `done` nor
  // POSTed. The guard must read this ref instead of the state.
  const phaseRef = useRef<Phase>('intro');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  // UX-2: 1-based current set. Reps within the set are tracked in `repCount`
  // (reset to 0 at the start of every set).
  const [currentSet, setCurrentSet] = useState(1);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  // BUG-1 — watchdog flag. When true, the `preparing` phase swaps its spinner
  // for an in-place "Reintentar" button without leaving the session.
  const [cameraStalled, setCameraStalled] = useState(false);
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
  // BUG-1 — watchdog timer + acquisition generation. The generation is bumped
  // on every (re)acquire so a stale async chain (slow getUserMedia / model
  // load from a previous attempt) can detect it lost the race and bail out.
  const watchdogRef = useRef<number | null>(null);
  const acquireGenRef = useRef(0);
  // Set once the rAF loop has rendered a real frame. The watchdog reads this
  // to decide whether the camera is actually alive.
  const firstFrameRef = useRef(false);

  // Rep tracking ref state (not driving renders directly — we sample to UI refs).
  // UX-2: `repCountRef` is reps WITHIN THE CURRENT SET (0..repsPerSet). The
  // globally increasing rep index used for `rep_index` in the DB payload lives
  // in `globalRepRef`, so the API contract (1..sets*reps) is untouched. The
  // current set (1-based) is mirrored in `currentSetRef` for the rAF loop.
  const repCountRef = useRef(0);
  const globalRepRef = useRef(0);
  const currentSetRef = useRef(1);
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
    if (watchdogRef.current !== null) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
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

      // FB-1: the fingers contributing to the rep driver + per-joint peaks are
      // the resolved driver set (injured fingers, or the target selection minus
      // amputated). If empty (e.g. the only target finger is amputated) there is
      // nothing to measure this frame.
      const fingers = FINGERS.filter((f) => driverFingerNames.includes(f.name));
      if (fingers.length === 0) return;

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
        // UX-2: the DB `rep_index` stays GLOBALLY increasing across sets
        // (1..sets*reps), so the API contract is untouched. `repCountRef`
        // counts reps WITHIN the current set (drives the "Rep X de N" UI).
        globalRepRef.current += 1;
        const completed = { ...rec, rep_index: globalRepRef.current };
        repHistoryRef.current.push(completed);
        repCountRef.current += 1;
        setRepCount(repCountRef.current);

        // BUG-3 — rep coaching wiring. Feed the just-completed rep's flexion
        // peak ON THE DRIVER JOINT (normalized clinical degrees, the same
        // scale `updateRepCoaching`'s threshold is expressed in) into the
        // coaching state machine. After a warm-up grace of the first 3 reps,
        // if the helper returns a `push_more` suggestion we surface the toast.
        // Previously `updateRepCoaching` was imported but never invoked, so the
        // surgeon never saw any coaching ("NO SALE NADA DE AVISOS"). Grace is
        // measured against the GLOBAL rep count so it isn't reset each set.
        const completedPeakFlex = completed.perJoint[driverJoint]?.peakFlex ?? 0;
        const REP_COACHING_GRACE = 3;
        if (globalRepRef.current > REP_COACHING_GRACE) {
          const { state: nextCoaching, suggestion } = updateRepCoaching(
            repCoachingRef.current,
            { peakFlexion: completedPeakFlex },
          );
          repCoachingRef.current = nextCoaching;
          if (suggestion === 'push_more') {
            showToast('Intenta llegar un poco más lejos en cada repetición 💪', 3500);
          }
        }

        // Reset rolling rep record (rep_index will be set when the next rep
        // closes; keep it provisional at the next global index here).
        currentRepRef.current = {
          rep_index: globalRepRef.current,
          perJoint: {},
          framesTotal: 0,
          framesMissing: 0,
        };
        directionRef.current = 'open';
        // Reset the displayed "peak this rep" so the indicator resets too.
        displayPeakRef.current = 0;

        // UX-2: end-of-set handling.
        if (repCountRef.current >= repsPerSet) {
          if (currentSetRef.current >= sets) {
            // Last set finished → summary + POST as before.
            finishSession();
          } else {
            // More sets to go → pause and show the rest screen.
            startRest();
          }
        }
      } else if (directionRef.current === null) {
        directionRef.current = 'open';
      }
    },
    // finishSession / startRest defined below; eslint disabled for the same
    // reason as above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [driverFingerNames, repsPerSet, sets, trackedJoints, showToast],
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

    // BUG-1 — first decodable frame seen: camera is alive, leave `preparing`.
    if (!firstFrameRef.current) {
      firstFrameRef.current = true;
      if (watchdogRef.current !== null) {
        window.clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
      setCameraStalled(false);
      setPhase('running');
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
        fingerStatus,
        fingerAngles,
      );
      processLandmarks(hand);
    } else {
      processLandmarks(null);
    }

    scheduleNextFrame();
  }, [processLandmarks, fingerStatus]);

  const scheduleNextFrame = useCallback(() => {
    rafRef.current = requestAnimationFrame(renderFrame);
  }, [renderFrame]);

  // ---------- transitions ----------
  const finishSession = useCallback(() => {
    // Allow ending from `running` (rep target reached / "Terminar") and from
    // `resting` (UX-2 "Terminar ahora" between sets). Ignore otherwise.
    // NOTE: read the ref, not the state — this callback is invoked from the
    // rAF pipeline whose closure was created back in the 'intro' render.
    if (phaseRef.current !== 'running' && phaseRef.current !== 'resting') return;
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
  }, [stopLoop, trackedJoints]);

  // UX-2 — between sets: pause the rAF loop (stops counting) but KEEP the
  // camera stream alive so resuming is instant. The friendly rest panel is
  // rendered in the `resting` phase.
  const startRest = useCallback(() => {
    stopLoop();
    directionRef.current = null;
    setPhase('resting');
  }, [stopLoop]);

  // UX-2 — tap "Empezar serie n+1": advance the set, reset the per-set rep
  // counter and the rolling rep record, and resume the loop at rep 1 of the
  // new set. The global rep index and the accumulated rep history are
  // preserved so the payload total stays correct.
  const resumeSet = useCallback(() => {
    currentSetRef.current += 1;
    setCurrentSet(currentSetRef.current);
    repCountRef.current = 0;
    setRepCount(0);
    directionRef.current = null;
    angleHistoryRef.current = [];
    displayHistoryRef.current = [];
    displayPeakRef.current = 0;
    currentRepRef.current = {
      rep_index: globalRepRef.current,
      perJoint: {},
      framesTotal: 0,
      framesMissing: 0,
    };
    setPhase('running');
    scheduleNextFrame();
  }, [scheduleNextFrame]);

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
          // peakExt is kept as a positive magnitude for the UI, but the DB
          // contract stores extension as a SIGNED NEGATIVE value: the B-14
          // aggregation (patient_progression) takes min(max_extension_deg)
          // to find the deepest extension excursion. Persisting a positive
          // magnitude would invert that ranking (BUG-4 follow-up, 2026-05-20).
          max_extension_deg: slot.peakExt ? -slot.peakExt : null,
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

  // BUG-1 — load the MediaPipe HandLandmarker (GPU, then CPU fallback). Pure
  // async; the camera path runs in parallel with this.
  const loadLandmarker = useCallback(async (): Promise<HandLandmarkerInstance> => {
    const vision = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
    const make = (delegate: 'GPU' | 'CPU') =>
      vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: HAND_LANDMARKER_MODEL_URL, delegate },
        numHands: 1,
        runningMode: 'VIDEO',
      }) as unknown as Promise<HandLandmarkerInstance>;
    try {
      return await make('GPU');
    } catch (err) {
      console.error('[ExerciseSession] MediaPipe GPU init failed, trying CPU', err);
      return await make('CPU');
    }
  }, []);

  // BUG-1 — attach a stream to the <video> and start playback inside (or
  // synchronously chained from) the user-gesture stack. Retries `play()` once
  // on the next `loadedmetadata` if the first attempt rejects (iOS Safari).
  const attachAndPlay = useCallback((video: HTMLVideoElement, stream: MediaStream) => {
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    const tryPlay = () => video.play().catch(() => undefined);
    void tryPlay().then(() => {
      if (video.readyState < 2) {
        const onMeta = () => {
          video.removeEventListener('loadedmetadata', onMeta);
          void tryPlay();
        };
        video.addEventListener('loadedmetadata', onMeta);
      }
    });
  }, []);

  // BUG-1 — single acquisition routine used by both the initial "Empezar" tap
  // and the in-place "Reintentar" button. Cleans up any previous stream first,
  // requests the camera, attaches it to the already-mounted <video>, loads the
  // model in parallel, and arms the watchdog. The phase flip to `running`
  // happens in `renderFrame` once a real frame is decoded.
  const acquireCamera = useCallback(async () => {
    const gen = (acquireGenRef.current += 1);
    setPermissionError(null);
    setCameraStalled(false);
    firstFrameRef.current = false;

    // Clean up any prior attempt (stop old tracks before re-acquiring).
    stopLoop();
    stopStream();
    if (watchdogRef.current !== null) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }

    // Arm the watchdog: if no frame has rendered within the window, offer retry.
    watchdogRef.current = window.setTimeout(() => {
      if (acquireGenRef.current === gen && !firstFrameRef.current) {
        setCameraStalled(true);
      }
    }, CAMERA_WATCHDOG_MS);

    // Kick off the model load in parallel with the camera request.
    const landmarkerPromise = loadLandmarker();

    // Request the camera (the user gesture is the tap that called us).
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
    } catch (err) {
      if (acquireGenRef.current !== gen) return; // stale attempt
      const e = err as { name?: string };
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        setPermissionError(
          'No has dado permiso a la cámara. Habilítala en los ajustes del navegador.',
        );
      } else if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') {
        setPermissionError('No detectamos ninguna cámara en este dispositivo.');
      } else {
        setPermissionError('No se ha podido iniciar la cámara.');
      }
      if (watchdogRef.current !== null) {
        window.clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
      teardown();
      setPhase('intro');
      return;
    }
    if (acquireGenRef.current !== gen) {
      // A newer attempt superseded us; drop this stream.
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    // The <video> is already mounted (we are in `preparing`). Assign + play.
    const video = videoRef.current;
    if (video) attachAndPlay(video, stream);

    // Await the model (already in flight). On failure, surface and bail out.
    try {
      const landmarker = await landmarkerPromise;
      if (acquireGenRef.current !== gen) {
        landmarker.close?.();
        return;
      }
      landmarkerRef.current = landmarker;
    } catch (err) {
      if (acquireGenRef.current !== gen) return;
      console.error('[ExerciseSession] MediaPipe init failed', err);
      setPermissionError('No hemos podido cargar el detector de mano. Comprueba tu conexión.');
      if (watchdogRef.current !== null) {
        window.clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
      teardown();
      setPhase('intro');
      return;
    }

    // Reset rep + display accumulators, then start the rAF loop. The loop will
    // flip the phase to `running` once it decodes the first frame.
    // UX-2: also reset the per-set and global counters so a fresh "Empezar"
    // always starts at Serie 1 · Rep 0.
    repCountRef.current = 0;
    globalRepRef.current = 0;
    currentSetRef.current = 1;
    setCurrentSet(1);
    repHistoryRef.current = [];
    angleHistoryRef.current = [];
    directionRef.current = null;
    currentRepRef.current = { rep_index: 0, perJoint: {}, framesTotal: 0, framesMissing: 0 };
    repCoachingRef.current = createRepCoaching();
    handednessSamplesRef.current = [];
    handednessFiredRef.current = false;
    displayHistoryRef.current = [];
    displayAngleRef.current = 0;
    displayPeakRef.current = 0;
    displayPerJointRef.current = {};
    setRepCount(0);
    setLiveAngle(0);
    setLivePeak(0);
    setLivePerJoint({});
    scheduleNextFrame();
  }, [attachAndPlay, loadLandmarker, scheduleNextFrame, stopLoop, stopStream, teardown]);

  // "Empezar" tap: flip to `preparing` immediately (so we never show a black
  // void) and acquire the camera. The <video> mounts in `preparing`.
  const startSession = useCallback(() => {
    startedAtRef.current = new Date().toISOString();
    setPhase('preparing');
    void acquireCamera();
  }, [acquireCamera]);

  // In-place retry (watchdog button). Stays in the session; re-acquires.
  const retryCamera = useCallback(() => {
    void acquireCamera();
  }, [acquireCamera]);

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
              {exercise.name}
            </h1>
            {/* UX-1 — spell the dose out in full ("3 series de 20 */}
            {/* repeticiones, 4 veces al día"). Patients get lost on raw totals. */}
            <p
              data-testid="dose-sentence"
              className="mt-2 text-[18px] font-semibold leading-snug text-[#007AFF]"
            >
              {doseSentence}
            </p>
            {measuringLabel ? (
              <p className="mt-1 text-[15px] text-gray-600">
                Vamos a medir tu <span className="font-semibold">{measuringLabel.toLowerCase()}</span>.
              </p>
            ) : null}
            {exercise.description ? (
              <p className="mt-4 text-[16px] leading-relaxed text-gray-600">
                {exercise.description}
              </p>
            ) : null}
          </section>

          {/* Exercise animation. */}
          <section className="mt-6 flex justify-center rounded-2xl border border-gray-100 bg-white p-5">
            <ExerciseAnimation exerciseCode={exercise.code} className="h-40 w-40" />
          </section>

          {/* UX-3 (surgeon, 2026-05-20) — the angle reads only work when the */}
          {/* hand is in PROFILE, not facing the camera. Prominent callout. */}
          <div
            data-testid="profile-instruction"
            className="mt-4 flex items-start gap-2 rounded-2xl border border-[#007AFF]/20 bg-[#007AFF]/5 p-4 text-[14px] leading-snug text-[#004999]"
          >
            <span aria-hidden className="text-[18px] leading-none">📐</span>
            <span>
              <span className="font-semibold">Coloca la mano DE PERFIL a la cámara</span>{' '}
              (como cuando das la mano). Si la pones de frente, los grados no se
              miden bien.
            </span>
          </div>

          <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-5">
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

  if (phase === 'preparing' || phase === 'running' || phase === 'resting') {
    return (
      <main className="relative min-h-screen w-full overflow-hidden bg-black text-white">
        {/* BUG-1 — video + canvas are mounted in `preparing`, `running` AND */}
        {/* `resting` (UX-2), so the stream can attach to an existing element, */}
        {/* the loop can decode the first frame before we reveal the HUD, and */}
        {/* the rest screen between sets keeps the camera alive for an instant */}
        {/* resume. */}
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

        {/* BUG-1 — preparing overlay: visible spinner (never a black void), */}
        {/* a profile-hand reminder (UX-3), and a watchdog retry button. */}
        {phase === 'preparing' ? (
          <div
            data-testid="camera-preparing"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 px-6 text-center"
          >
            {cameraStalled ? (
              <>
                <p className="text-[16px] font-semibold">La cámara no arranca</p>
                <p className="max-w-[280px] text-[14px] text-white/70">
                  A veces tarda en activarse. Pulsa para volver a intentarlo sin
                  salir del ejercicio.
                </p>
                {permissionError ? (
                  <p
                    data-testid="camera-error"
                    role="alert"
                    className="max-w-[280px] text-[13px] text-red-300"
                  >
                    {permissionError}
                  </p>
                ) : null}
                <button
                  type="button"
                  data-testid="camera-retry"
                  onClick={retryCamera}
                  className="mt-1 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-[15px] font-semibold text-gray-900 active:bg-gray-200"
                >
                  <RotateCcw size={18} aria-hidden /> Reintentar
                </button>
              </>
            ) : (
              <>
                <Loader2 size={36} className="animate-spin text-white/90" aria-hidden />
                <p className="text-[16px] font-semibold">Preparando cámara…</p>
                <p className="max-w-[280px] text-[13px] text-white/70">
                  📐 Recuerda colocar la mano DE PERFIL a la cámara.
                </p>
              </>
            )}
          </div>
        ) : null}

        {/* UX-2 — rest screen between sets. Camera stream stays alive behind */}
        {/* this panel; counting is paused until the patient taps to continue. */}
        {phase === 'resting' ? (
          <div
            data-testid="rest-screen"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black/80 px-6 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#34C759]/20 text-[#34C759]">
              <CheckCircle2 size={40} strokeWidth={2.2} aria-hidden />
            </div>
            <div>
              <p className="text-[22px] font-semibold">
                Serie {currentSet} de {sets} completada
              </p>
              <p className="mt-2 text-[15px] text-white/70">
                Descansa un momento. Cuando estés listo, sigue con la siguiente
                serie.
              </p>
            </div>
            <button
              type="button"
              data-testid="start-next-set"
              onClick={resumeSet}
              className="mt-2 flex h-14 w-full max-w-[320px] items-center justify-center rounded-2xl bg-[#007AFF] text-[18px] font-semibold text-white active:bg-[#005BB5]"
            >
              Empezar serie {currentSet + 1}
            </button>
            <button
              type="button"
              data-testid="end-session"
              onClick={handleEnd}
              className="text-[15px] font-medium text-white/70 underline-offset-2 active:underline"
            >
              Terminar ahora
            </button>
          </div>
        ) : null}

        {/* HUD — only while running. */}
        <div
          className={`relative z-10 flex h-screen flex-col ${
            phase === 'running' ? '' : 'pointer-events-none opacity-0'
          }`}
        >
          {/* BUG-2 — top controls get safe-area padding so the Terminar */}
          {/* button + angle HUD clear the iOS notch / status bar. */}
          <div
            data-testid="session-top-controls"
            className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]"
          >
            {/* Top row: rep counter (left) + Terminar (right). Kept as its */}
            {/* own row so the wide angle HUD below can never push Terminar */}
            {/* off-screen (BUG-2: it was overflowing the right edge at 390px). */}
            <div className="flex items-start justify-between gap-3">
              {/* UX-2 — counter is PER SET ("Rep X de 20"), with a secondary */}
              {/* "Serie n de N" so the patient never sees a scary "1/100". */}
              <div className="rounded-2xl bg-black/50 px-4 py-3 backdrop-blur">
                <div className="text-[12px] uppercase tracking-wider text-white/70">
                  Repetición
                </div>
                <div className="mt-0.5 text-[28px] font-semibold leading-none">
                  <span data-testid="rep-counter">{repCount}</span>
                  <span className="text-white/60"> de {repsPerSet}</span>
                </div>
                <div
                  data-testid="set-counter"
                  className="mt-1 text-[13px] font-medium text-white/80"
                >
                  Serie {currentSet} de {sets}
                </div>
                {measuringLabel ? (
                  <div
                    data-testid="measuring-finger"
                    className="mt-1 text-[12px] text-[#FF9F0A]"
                  >
                    Midiendo: {measuringLabel}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                data-testid="end-session"
                onClick={handleEnd}
                className="rounded-full bg-white/20 px-4 py-2 text-[14px] font-semibold backdrop-blur active:bg-white/30"
              >
                Terminar
              </button>
            </div>

            {/* F-13 — live angle indicator overlay. Frosted white panel so it */}
            {/* reads against the camera background regardless of skin tone or */}
            {/* lighting. On its own row, right-aligned, below the controls. */}
            <div className="mt-3 flex justify-end">
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

        {/* BUG-3 — coaching toast. Centered near the bottom, high z-index and */}
        {/* an opaque blue pill so it survives the angle HUD overlap and reads */}
        {/* clearly over the camera feed. */}
        {phase === 'running' && toast ? (
          <button
            type="button"
            key={toast.id}
            data-testid="coaching-toast"
            onClick={dismissToast}
            className="absolute bottom-[max(2rem,env(safe-area-inset-bottom))] left-1/2 z-30 max-w-[88%] -translate-x-1/2 rounded-2xl bg-[#007AFF] px-5 py-3 text-center text-[15px] font-semibold text-white shadow-xl"
          >
            {toast.text}
          </button>
        ) : null}
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
        <h1 className="mt-6 text-[28px] font-semibold tracking-tight text-gray-900">
          Sesión terminada
        </h1>
        <p className="mt-2 text-[15px] text-gray-600">
          {repsCompleted} de {targetReps} repeticiones detectadas.
        </p>

        {summary ? (
          <section className="mt-8 rounded-2xl border border-gray-100 bg-white p-5 text-left">
            <h2 className="text-[15px] font-semibold text-gray-900">Pico medio por articulación</h2>
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
