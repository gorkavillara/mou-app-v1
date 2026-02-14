'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

type ExerciseDemoProps = {
  exerciseName: string;
  description: string;
  targetReps: number;
  videoUrl?: string;
  onStart: () => void;
};

function VideoPlaceholder({ exerciseName }: { exerciseName: string }) {
  return (
    <div className="w-full aspect-[9/16] bg-gray-100 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-gray-200 p-6 text-center">
      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
        <Play className="w-6 h-6 text-blue-600 fill-blue-600" />
      </div>
      <h4 className="text-sm font-semibold text-gray-900 mb-1">Video Demostrativo</h4>
      <p className="text-xs text-gray-500">
        Espacio para el video de: <br />
        <span className="font-medium text-blue-600">{exerciseName}</span>
      </p>
      <div className="mt-4 px-3 py-1 bg-gray-200 rounded text-[10px] text-gray-600 font-mono">
        assets/videos/{exerciseName.toLowerCase().replace(/\s+/g, '-')}.mp4
      </div>
    </div>
  );
}


export function ExerciseDemo({
  exerciseName,
  description,
  targetReps,
  videoUrl,
  onStart,
}: ExerciseDemoProps) {
  return (
    <div className="fixed inset-0 bg-gray-900/95 z-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl max-w-sm w-full p-6 flex flex-col items-center gap-5"
      >
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">{exerciseName}</h2>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>

        <div className="w-full max-w-[240px] mx-auto">
          {videoUrl ? (
            <video
              src={videoUrl}
              className="w-full aspect-[9/16] rounded-xl object-cover bg-gray-100"
              controls
              autoPlay
              loop
              muted
            />
          ) : (
            <VideoPlaceholder exerciseName={exerciseName} />
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{targetReps}</div>
            <div className="text-xs text-gray-500">Repeticiones</div>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Realiza el movimiento como se muestra en la animacion.
          La camara detectara tu mano automaticamente.
        </p>

        <button
          onClick={onStart}
          className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <Play size={20} />
          Comenzar Serie
        </button>
      </motion.div>
    </div>
  );
}
