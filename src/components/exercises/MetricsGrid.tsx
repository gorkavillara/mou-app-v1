import React from 'react';
import { MetricCard } from './MetricCard';
import {
  Gauge,
  TrendingUp,
  TrendingDown,
  Repeat,
  Clock,
  Target
} from 'lucide-react';
import type { RepData } from '@/lib/hand-tracking';

type MetricsGridProps = {
  rom: number;
  maxFlexion: number;
  maxExtension: number;
  repetitions: number;
  targetReps: number;
  elapsedTime: number;
  progress: number;
  lastRep: RepData | null;
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getRomStatus(rom: number): 'good' | 'active' | 'attention' | 'neutral' {
  if (rom >= 60) return 'good';
  if (rom >= 30) return 'active';
  if (rom > 0) return 'attention';
  return 'neutral';
}

export function MetricsGrid({
  rom,
  maxFlexion,
  maxExtension,
  repetitions,
  targetReps,
  elapsedTime,
  progress,
  lastRep,
}: MetricsGridProps) {
  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Primary: Repetitions progress */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-semibold text-gray-700">Repeticiones</span>
          </div>
          <span className="text-xs text-gray-400">{formatTime(elapsedTime)}</span>
        </div>
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-4xl font-bold text-gray-900">{repetitions}</span>
          <span className="text-lg text-gray-400">/ {targetReps}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        {lastRep && (
          <div className="mt-2 text-xs text-gray-500 flex gap-3">
            <span>Rep {lastRep.repNumber}: F {lastRep.maxFlexion}° / E {lastRep.maxExtension}°</span>
          </div>
        )}
      </div>

      {/* Secondary metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="ROM"
          value={rom}
          unit="°"
          status={getRomStatus(rom)}
          icon={<Gauge className="w-4 h-4" />}
        />
        <MetricCard
          label="Flexion Max"
          value={maxFlexion}
          unit="°"
          status={maxFlexion > 0 ? 'active' : 'neutral'}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <MetricCard
          label="Extension Max"
          value={maxExtension}
          unit="°"
          status={maxExtension > 0 ? 'active' : 'neutral'}
          icon={<TrendingDown className="w-4 h-4" />}
        />
        <MetricCard
          label="Progreso"
          value={progress}
          unit="%"
          status={progress >= 100 ? 'good' : progress >= 50 ? 'active' : 'attention'}
          icon={<Target className="w-4 h-4" />}
          progress={progress}
        />
      </div>
    </div>
  );
}
