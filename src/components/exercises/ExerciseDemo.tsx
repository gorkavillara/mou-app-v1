'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

type ExerciseDemoProps = {
  exerciseName: string;
  description: string;
  targetReps: number;
  onStart: () => void;
};

function WristFlexionAnimation() {
  return (
    <svg viewBox="0 0 200 260" className="w-48 h-60">
      {/* Forearm */}
      <rect x="75" y="180" width="50" height="80" rx="8" fill="#D1D5DB" />
      <line
        x1="100" y1="260" x2="100" y2="180"
        stroke="#A78BFA" strokeWidth="2" strokeDasharray="6 3"
      />
      <circle cx="100" cy="240" r="4" fill="#A78BFA" />

      {/* Wrist joint */}
      <circle cx="100" cy="180" r="6" fill="#10B981" stroke="#fff" strokeWidth="2" />

      {/* Hand that rotates (wrist flexion/extension) */}
      <motion.g
        style={{ originX: '100px', originY: '180px' }}
        animate={{ rotate: [0, -30, 0, 30, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Palm */}
        <rect x="70" y="120" width="60" height="60" rx="10" fill="#93C5FD" />
        {/* Fingers */}
        <rect x="74" y="60" width="10" height="60" rx="5" fill="#60A5FA" />
        <rect x="87" y="50" width="10" height="70" rx="5" fill="#60A5FA" />
        <rect x="100" y="55" width="10" height="65" rx="5" fill="#60A5FA" />
        <rect x="113" y="65" width="10" height="55" rx="5" fill="#60A5FA" />
        {/* Thumb */}
        <rect
          x="55" y="130" width="10" height="40" rx="5" fill="#60A5FA"
          transform="rotate(-20 60 130)"
        />
      </motion.g>
    </svg>
  );
}

export function ExerciseDemo({
  exerciseName,
  description,
  targetReps,
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

        <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-center">
          <WristFlexionAnimation />
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
