'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  FilesetResolver,
  HandLandmarker,
  HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { DashboardHeader } from '@/components/exercises/DashboardHeader';
import { MetricsGrid } from '@/components/exercises/MetricsGrid';
import { ExerciseDemo } from '@/components/exercises/ExerciseDemo';
import { FingerSelector } from '@/components/exercises/FingerSelector';
import { ExerciseSelector } from '@/components/exercises/ExerciseSelector';
import { Hand } from 'lucide-react';
import { AppNav } from '@/components/AppNav';
import { type Exercise } from '@/data/exercises';
import {
  calculateAllFingerAngles,
  getExerciseAngle,
  drawHand,
  createRepCounter,
  updateRepCounter,
  DEFAULT_FINGER_STATUS,
  type FingerStatusMap,
  type FingerAngles,
  type RepCounter,
  type RepData,
} from '@/lib/hand-tracking';

const TARGET_REPS = 10;

type Metrics = {
  rom: number;
  maxFlexion: number;
  maxExtension: number;
  repetitions: number;
  elapsedTime: number;
  progress: number;
  lastRep: RepData | null;
};

type Phase = 'exercise-select' | 'finger-select' | 'demo' | 'tracking';

export default function Exercises() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);
  const repCounterRef = useRef<RepCounter>(createRepCounter());

  const [phase, setPhase] = useState<Phase>('exercise-select');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fingerStatus, setFingerStatus] = useState<FingerStatusMap>(DEFAULT_FINGER_STATUS);
  const [showFingerSelector, setShowFingerSelector] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>({
    rom: 0,
    maxFlexion: 0,
    maxExtension: 0,
    repetitions: 0,
    elapsedTime: 0,
    progress: 0,
    lastRep: null,
  });

  // Load finger status from localStorage on mount
  useEffect(() => {
    const savedStatus = localStorage.getItem('fingerStatus');
    if (savedStatus) {
      try {
        const parsed = JSON.parse(savedStatus);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFingerStatus(parsed);
      } catch (e) {
        console.error('Error loading finger status from localStorage', e);
      }
    }
  }, []);

  // Save finger status to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('fingerStatus', JSON.stringify(fingerStatus));
  }, [fingerStatus]);

  // Keep ref in sync so the rAF loop always reads the latest value
  const fingerStatusRef = useRef(fingerStatus);
  useEffect(() => {
    fingerStatusRef.current = fingerStatus;
  }, [fingerStatus]);

  const detectHands = useCallback(() => {
    const step = () => {
      if (!videoRef.current || !canvasRef.current || !handLandmarkerRef.current) {
        animationFrameRef.current = requestAnimationFrame(step);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.readyState !== 4) {
        animationFrameRef.current = requestAnimationFrame(step);
        return;
      }

      // Match canvas internal resolution to its CSS display size so that
      // drawn pixels map 1:1 to screen pixels (no extra scaling artifacts).
      const displayW = canvas.clientWidth || video.videoWidth;
      const displayH = canvas.clientHeight || video.videoHeight;
      if (canvas.width !== displayW) canvas.width = displayW;
      if (canvas.height !== displayH) canvas.height = displayH;

      let ts = Math.floor(video.currentTime * 1000);
      if (ts <= lastTimestampRef.current) {
        ts = lastTimestampRef.current + 1;
      }
      lastTimestampRef.current = ts;

      const results: HandLandmarkerResult =
        handLandmarkerRef.current.detectForVideo(video, ts);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        const fingerAngles: FingerAngles = calculateAllFingerAngles(landmarks);

        drawHand(
          ctx,
          landmarks,
          canvas.width,
          canvas.height,
          video.videoWidth,
          video.videoHeight,
          fingerStatusRef.current,
          fingerAngles,
        );

        const angle = getExerciseAngle(landmarks, fingerStatusRef.current);
        repCounterRef.current = updateRepCounter(repCounterRef.current, angle);

        const counter = repCounterRef.current;

        setMetrics((prev) => {
          const newMaxFlexion =
            angle > 0
              ? Math.max(prev.maxFlexion, Math.round(angle))
              : prev.maxFlexion;
          const newMaxExtension =
            angle < 0
              ? Math.max(prev.maxExtension, Math.round(Math.abs(angle)))
              : prev.maxExtension;
          const newRom = newMaxFlexion + newMaxExtension;
          const newProgress = Math.min(
            100,
            Math.round((counter.repCount / TARGET_REPS) * 100)
          );

          const lastRep =
            counter.repHistory.length > 0
              ? counter.repHistory[counter.repHistory.length - 1]
              : null;

          return {
            ...prev,
            rom: newRom,
            maxFlexion: newMaxFlexion,
            maxExtension: newMaxExtension,
            repetitions: counter.repCount,
            progress: newProgress,
            lastRep,
          };
        });
      }

      animationFrameRef.current = requestAnimationFrame(step);
    };
    step();
  }, []);

  useEffect(() => {
    if (phase !== 'tracking') return;

    let isMounted = true;
    const videoEl = videoRef.current;

    async function initializeHandTracking() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
        );

        let handLandmarker: HandLandmarker;
        try {
          handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
          });
        } catch {
          handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
          });
        }

        if (!isMounted) return;

        handLandmarkerRef.current = handLandmarker;

        // Let the browser choose a resolution suitable for the device;
        // coordinate remapping handles any aspect ratio.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsLoading(false);
          startTimeRef.current = Date.now();
          detectHands();
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Error al inicializar el tracking'
          );
          setIsLoading(false);
        }
      }
    }

    initializeHandTracking();

    return () => {
      isMounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (videoEl?.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [phase, detectHands]);

  // Timer effect
  useEffect(() => {
    if (phase !== 'tracking') return;

    const interval = setInterval(() => {
      if (startTimeRef.current > 0) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setMetrics((prev) => ({ ...prev, elapsedTime: elapsed }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  // --- Phase screens ---

  if (phase === 'exercise-select') {
    return (
      <ExerciseSelector
        onSelect={(exercise) => {
          setSelectedExercise(exercise);
          setPhase('finger-select');
        }}
      />
    );
  }

  if (phase === 'finger-select') {
    return (
      <FingerSelector
        fingerStatus={fingerStatus}
        onChange={setFingerStatus}
        onConfirm={() => setPhase('demo')}
      />
    );
  }

  if (phase === 'demo') {
    return (
      <ExerciseDemo
        exerciseName={selectedExercise?.name || 'Ejercicio'}
        description={selectedExercise?.description || ''}
        videoUrl={selectedExercise?.videoUrl}
        targetReps={TARGET_REPS}
        onStart={() => setPhase('tracking')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:pl-[220px]">
      <AppNav active="/exercises" />
      <DashboardHeader
        exerciseName={selectedExercise?.name || 'Ejercicio'}
        dayInfo="Dia 3"
        phaseInfo="Fase Inicial"
      />

      <main className="flex-1 flex flex-col w-full max-w-3xl mx-auto pb-20 md:pb-0">
        {/* Camera + overlay section */}
        <div className="relative bg-gray-900 flex-1 min-h-[50vh] overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Iniciando cámara...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-red-500 text-xl">!</span>
                </div>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Video feed – fills container, content object-fit: cover */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Canvas overlay – internal resolution set dynamically to match container */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Rep counter – top right */}
          {!isLoading && !error && (
            <div className="absolute top-3 right-3 z-20">
              <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-4 py-2 text-center min-w-[72px]">
                <div className="text-white font-bold text-4xl leading-none tabular-nums">
                  {metrics.repetitions}
                </div>
                <div className="text-white/60 text-xs mt-0.5 font-medium">
                  / {TARGET_REPS} reps
                </div>
              </div>
            </div>
          )}

          {/* Tracking status + finger selector – top left */}
          {!isLoading && !error && (
            <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                  <span className="text-white text-xs font-medium">
                    Tracking activo
                  </span>
                </div>
                <button
                  onClick={() => setShowFingerSelector(true)}
                  className="bg-black/50 backdrop-blur-sm rounded-lg p-1.5"
                >
                  <Hand size={16} className="text-white" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="bg-gray-50 border-t border-gray-200">
          <MetricsGrid
            rom={metrics.rom}
            maxFlexion={metrics.maxFlexion}
            maxExtension={metrics.maxExtension}
            repetitions={metrics.repetitions}
            targetReps={TARGET_REPS}
            elapsedTime={metrics.elapsedTime}
            progress={metrics.progress}
            lastRep={metrics.lastRep}
          />
        </div>
      </main>

      {/* Finger selector modal */}
      {showFingerSelector && (
        <FingerSelector
          fingerStatus={fingerStatus}
          onChange={setFingerStatus}
          onConfirm={() => setShowFingerSelector(false)}
        />
      )}
    </div>
  );
}
