'use client';

import { useState, useRef, useCallback } from 'react';
import {
  FilesetResolver,
  HandLandmarker,
  HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { createHandSignature, compareHandSignature, type HandSignature, type Point } from '@/lib/hand-tracking';
import type { Patient } from '@/data/patients';
import { Check, X, Loader2, Camera } from 'lucide-react';

type HandIdentityValidatorProps = {
  patient: Patient;
  onValidated: (handSignature?: HandSignature) => void;
  onSkip: () => void;
};

export function HandIdentityValidator({ patient, onValidated, onSkip }: HandIdentityValidatorProps) {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'validating' | 'success' | 'failed'>('idle');
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  const existingSignature = (patient as ExtendedPatient).handSignature;

  const stopScanning = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  }, []);

  const runDetection = useCallback(() => {
    const step = () => {
      if (!videoRef.current || !canvasRef.current || !handLandmarkerRef.current) {
        animationRef.current = requestAnimationFrame(step);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.readyState !== 4) {
        animationRef.current = requestAnimationFrame(step);
        return;
      }

      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      const ts = Math.floor(video.currentTime * 1000);
      const results: HandLandmarkerResult = handLandmarkerRef.current.detectForVideo(video, ts);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        if (existingSignature) {
          setStatus('validating');
          const sim = compareHandSignature(existingSignature, landmarks as Point[]);
          setSimilarity(sim);

          if (sim >= 85) {
            setStatus('success');
            stopScanning();
            const signature = createHandSignature(landmarks as Point[]);
            onValidated(signature);
          } else {
            setStatus('failed');
            stopScanning();
          }
        } else {
          const signature = createHandSignature(landmarks as Point[]);
          setStatus('success');
          stopScanning();
          onValidated(signature);
        }
      }

      if (status === 'scanning') {
        animationRef.current = requestAnimationFrame(step);
      }
    };
    step();
  }, [existingSignature, onValidated, status, stopScanning]);

  const startScanning = useCallback(async () => {
    setStatus('scanning');
    setError(null);

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

      handLandmarkerRef.current = handLandmarker;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        runDetection();
      }
    } catch {
      setError('Error al inicializar la cámara');
      setStatus('idle');
    }
  }, [runDetection]);

  const handleManualCode = () => {
    if (manualCode.length === 4) {
      onSkip();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Validar Identidad
        </h2>
        <p className="text-gray-600 mb-6">
          {existingSignature
            ? 'Coloca tu mano frente a la cámara para verificar tu identidad'
            : 'Primera sesión - registramos tu hand signature'}
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {status === 'idle' && (
          <button
            onClick={startScanning}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2"
          >
            <Camera size={20} />
            Escanear Mano
          </button>
        )}

        {(status === 'scanning' || status === 'validating') && (
          <div className="relative aspect-video bg-gray-100 rounded-xl overflow-hidden">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              style={{ transform: 'scaleX(-1)' }}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ transform: 'scaleX(-1)' }}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
                <Loader2 size={16} className="text-white animate-spin" />
                <span className="text-white text-sm">
                  {status === 'validating' ? 'Validando...' : 'Escaneando...'}
                </span>
              </div>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-green-600" />
            </div>
            <p className="text-green-700 font-medium">
              {existingSignature ? 'Identidad verificada' : 'Hand signature registrado'}
            </p>
          </div>
        )}

        {status === 'failed' && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X size={32} className="text-orange-600" />
            </div>
            <p className="text-orange-700 font-medium mb-2">
              Identidad no verificada
            </p>
            <p className="text-gray-600 text-sm mb-4">
              Similitud: {similarity?.toFixed(1)}%
            </p>
            <button
              onClick={() => setShowManualInput(true)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-medium"
            >
              Usar código manual
            </button>
          </div>
        )}

        {showManualInput && (
          <div className="mt-4">
            <input
              type="text"
              maxLength={4}
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
              placeholder="Código de 4 dígitos"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl tracking-widest mb-3"
            />
            <button
              onClick={handleManualCode}
              disabled={manualCode.length !== 4}
              className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium"
            >
              Confirmar
            </button>
          </div>
        )}

        <button
          onClick={() => {
            stopScanning();
            onSkip();
          }}
          className="w-full mt-4 text-gray-500 hover:text-gray-700 py-2"
        >
          Omitir
        </button>
      </div>
    </div>
  );
}

type ExtendedPatient = Patient & {
  handSignature?: HandSignature;
};
