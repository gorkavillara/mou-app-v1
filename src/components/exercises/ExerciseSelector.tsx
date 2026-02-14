'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { EXERCISES, type Exercise } from '@/data/exercises';
import { ChevronRight, Activity } from 'lucide-react';

type ExerciseSelectorProps = {
  onSelect: (exercise: Exercise) => void;
};

export function ExerciseSelector({ onSelect }: ExerciseSelectorProps) {
  return (
    <div className="fixed inset-0 bg-gray-900/95 z-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl max-w-sm w-full p-6 flex flex-col gap-6"
      >
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Seleccionar Ejercicio</h2>
          <p className="text-sm text-gray-500 mt-1">
            Elige el ejercicio que vas a realizar hoy
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {EXERCISES.map((exercise) => (
            <button
              key={exercise.id}
              onClick={() => onSelect(exercise)}
              className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 transition-all text-left group"
            >
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Activity size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-sm">{exercise.name}</h3>
                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-tight">
                  {exercise.description}
                </p>
              </div>
              <ChevronRight size={20} className="text-gray-300 group-hover:text-blue-500" />
            </button>
          ))}
        </div>

        <p className="text-[10px] text-gray-400 text-center px-4">
          Asegúrate de tener buena iluminación y que tu mano sea visible en la cámara.
        </p>
      </motion.div>
    </div>
  );
}
