'use client';

import { useState } from 'react';
import { Plus, Minus, RotateCcw, CheckCircle2 } from 'lucide-react';

export type ManualRep = {
  id: number;
  flexion: number;
  extension: number;
  timestamp: number;
};

type ChecklistManualProps = {
  targetReps: number;
  onUpdate: (reps: number, lastRep: ManualRep | null) => void;
  onComplete: () => void;
};

export function ChecklistManual({ targetReps, onUpdate, onComplete }: ChecklistManualProps) {
  const [reps, setReps] = useState<ManualRep[]>([]);
  const [currentFlexion, setCurrentFlexion] = useState(45);
  const [currentExtension, setCurrentExtension] = useState(20);

  const addRep = () => {
    const newRep: ManualRep = {
      id: reps.length + 1,
      flexion: currentFlexion,
      extension: currentExtension,
      timestamp: Date.now(),
    };
    const newReps = [...reps, newRep];
    setReps(newReps);
    
    const maxFlexion = Math.max(...newReps.map(r => r.flexion), 0);
    const maxExtension = Math.max(...newReps.map(r => r.extension), 0);
    
    onUpdate(newReps.length, newReps.length > 0 ? newReps[newReps.length - 1] : null);

    if (newReps.length >= targetReps) {
      onComplete();
    }
  };

  const removeLastRep = () => {
    if (reps.length === 0) return;
    const newReps = reps.slice(0, -1);
    setReps(newReps);
    onUpdate(newReps.length, newReps.length > 0 ? newReps[newReps.length - 1] : null);
  };

  const reset = () => {
    setReps([]);
    onUpdate(0, null);
  };

  const progress = Math.min(100, Math.round((reps.length / targetReps) * 100));

  return (
    <div className="flex flex-col h-full bg-gray-50 p-4">
      <div className="bg-white rounded-2xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Registro Manual</h3>
          <button
            onClick={reset}
            className="text-gray-500 hover:text-gray-700 p-2"
            title="Reiniciar"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        <div className="flex items-center justify-center gap-8 mb-6">
          <div className="text-center">
            <div className="text-5xl font-bold text-cyan-600 tabular-nums">
              {reps.length}
            </div>
            <div className="text-gray-500 text-sm mt-1">
              / {targetReps} reps
            </div>
          </div>
        </div>

        <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
          <div
            className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Flexión (°)</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentFlexion(Math.max(0, currentFlexion - 5))}
                className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg"
              >
                <Minus size={16} />
              </button>
              <input
                type="number"
                value={currentFlexion}
                onChange={(e) => setCurrentFlexion(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 text-center border border-gray-200 rounded-lg py-1"
              />
              <button
                onClick={() => setCurrentFlexion(Math.min(120, currentFlexion + 5))}
                className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Extensión (°)</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentExtension(Math.max(0, currentExtension - 5))}
                className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg"
              >
                <Minus size={16} />
              </button>
              <input
                type="number"
                value={currentExtension}
                onChange={(e) => setCurrentExtension(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 text-center border border-gray-200 rounded-lg py-1"
              />
              <button
                onClick={() => setCurrentExtension(Math.min(60, currentExtension + 5))}
                className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={addRep}
            disabled={reps.length >= targetReps}
            className="flex-1 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Añadir Rep
          </button>
          <button
            onClick={removeLastRep}
            disabled={reps.length === 0}
            className="bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed p-3 rounded-xl"
          >
            <Minus size={20} className="text-gray-700" />
          </button>
        </div>
      </div>

      {reps.length > 0 && (
        <div className="bg-white rounded-2xl p-4 flex-1 overflow-auto">
          <h4 className="font-medium text-gray-700 mb-3">Historial</h4>
          <div className="space-y-2">
            {reps.map((rep) => (
              <div
                key={rep.id}
                className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-500" />
                  <span className="text-gray-700">Rep #{rep.id}</span>
                </div>
                <div className="text-sm text-gray-500">
                  Flex: {rep.flexion}° · Ext: {rep.extension}°
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
