'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import {
  FINGERS,
  type FingerName,
  type FingerStatus,
  type FingerStatusMap,
} from '@/lib/hand-tracking';

type FingerSelectorProps = {
  fingerStatus: FingerStatusMap;
  onChange: (status: FingerStatusMap) => void;
  onConfirm: () => void;
};

const STATUS_CYCLE: FingerStatus[] = ['normal', 'injured', 'amputated'];

const STATUS_STYLES: Record<FingerStatus, { bg: string; border: string; label: string; text: string }> = {
  normal: { bg: 'bg-blue-50', border: 'border-blue-200', label: 'Normal', text: 'text-blue-700' },
  injured: { bg: 'bg-orange-50', border: 'border-orange-300', label: 'Lesionado', text: 'text-orange-700' },
  amputated: { bg: 'bg-gray-100', border: 'border-gray-300', label: 'Amputado', text: 'text-gray-500' },
};

// SVG hand positions for each finger (approximate tap areas)
const FINGER_POSITIONS: Record<FingerName, { cx: number; cy: number }> = {
  pulgar: { cx: 32, cy: 130 },
  indice: { cx: 62, cy: 38 },
  medio: { cx: 88, cy: 22 },
  anular: { cx: 114, cy: 35 },
  menique: { cx: 137, cy: 60 },
};

const FINGER_COLORS: Record<FingerStatus, string> = {
  normal: '#3B82F6',
  injured: '#F97316',
  amputated: '#9CA3AF',
};

export function FingerSelector({ fingerStatus, onChange, onConfirm }: FingerSelectorProps) {
  function cycleStatus(name: FingerName) {
    const current = fingerStatus[name];
    const idx = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    onChange({ ...fingerStatus, [name]: next });
  }

  const hasInjured = Object.values(fingerStatus).some((s) => s === 'injured');

  return (
    <div className="fixed inset-0 bg-gray-900/95 z-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl max-w-sm w-full p-6 flex flex-col items-center gap-4"
      >
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">Seleccionar dedos</h2>
          <p className="text-sm text-gray-500 mt-1">
            Toca cada dedo para cambiar su estado
          </p>
        </div>

        {/* Visual hand SVG */}
        <div className="relative">
          <svg viewBox="0 0 170 220" className="w-44 h-56">
            {/* Palm */}
            <rect x="50" y="100" width="80" height="70" rx="12" fill="#E5E7EB" />

            {/* Forearm */}
            <rect x="60" y="170" width="60" height="50" rx="8" fill="#D1D5DB" />

            {/* Thumb */}
            <rect x="20" y="105" width="16" height="55" rx="8"
              fill={FINGER_COLORS[fingerStatus.pulgar]}
              opacity={fingerStatus.pulgar === 'amputated' ? 0.3 : 1}
              transform="rotate(-15 28 105)"
              className="cursor-pointer"
              onClick={() => cycleStatus('pulgar')}
            />

            {/* Index */}
            <rect x="54" y="30" width="16" height="75" rx="8"
              fill={FINGER_COLORS[fingerStatus.indice]}
              opacity={fingerStatus.indice === 'amputated' ? 0.3 : 1}
              className="cursor-pointer"
              onClick={() => cycleStatus('indice')}
            />

            {/* Middle */}
            <rect x="77" y="18" width="16" height="85" rx="8"
              fill={FINGER_COLORS[fingerStatus.medio]}
              opacity={fingerStatus.medio === 'amputated' ? 0.3 : 1}
              className="cursor-pointer"
              onClick={() => cycleStatus('medio')}
            />

            {/* Ring */}
            <rect x="100" y="28" width="16" height="75" rx="8"
              fill={FINGER_COLORS[fingerStatus.anular]}
              opacity={fingerStatus.anular === 'amputated' ? 0.3 : 1}
              className="cursor-pointer"
              onClick={() => cycleStatus('anular')}
            />

            {/* Pinky */}
            <rect x="123" y="48" width="14" height="58" rx="7"
              fill={FINGER_COLORS[fingerStatus.menique]}
              opacity={fingerStatus.menique === 'amputated' ? 0.3 : 1}
              className="cursor-pointer"
              onClick={() => cycleStatus('menique')}
            />

            {/* Tap indicator circles */}
            {FINGERS.map((f) => (
              <circle
                key={f.name}
                cx={FINGER_POSITIONS[f.name].cx}
                cy={FINGER_POSITIONS[f.name].cy}
                r="10"
                fill="transparent"
                className="cursor-pointer"
                onClick={() => cycleStatus(f.name)}
              />
            ))}
          </svg>
        </div>

        {/* Finger status list */}
        <div className="w-full grid grid-cols-1 gap-2">
          {FINGERS.map((finger) => {
            const status = fingerStatus[finger.name];
            const style = STATUS_STYLES[status];
            return (
              <button
                key={finger.name}
                onClick={() => cycleStatus(finger.name)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border ${style.bg} ${style.border} transition-colors`}
              >
                <span className="text-sm font-medium text-gray-700">{finger.label}</span>
                <span className={`text-xs font-semibold ${style.text} flex items-center gap-1`}>
                  {status === 'injured' && <X size={12} />}
                  {status === 'amputated' && <span className="opacity-50">--</span>}
                  {status === 'normal' && <Check size={12} />}
                  {style.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Normal
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" /> Lesionado
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-400" /> Amputado
          </span>
        </div>

        <button
          onClick={onConfirm}
          className={`w-full rounded-xl py-3 font-semibold transition-all ${
            hasInjured
              ? 'bg-blue-600 text-white active:scale-[0.98]'
              : 'bg-gray-200 text-gray-500'
          }`}
        >
          {hasInjured ? 'Confirmar seleccion' : 'Continuar sin seleccion'}
        </button>
      </motion.div>
    </div>
  );
}
