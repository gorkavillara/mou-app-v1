'use client';

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { CohortPatient } from '@/lib/doctor-types';
import { getDeviationData, getGlobalDeviationData } from '@/lib/doctor-utils';

interface DeviationChartProps {
  patient?: CohortPatient | null;
  showGlobal?: boolean;
}

export function DeviationChart({ patient, showGlobal = false }: DeviationChartProps) {
  const data = useMemo(() => {
    if (showGlobal) {
      return getGlobalDeviationData();
    }
    return getDeviationData(patient?.id);
  }, [patient, showGlobal]);

  const latestDeviation = data.length > 0 ? data[data.length - 1].desviacion : 0;

  const deviationTrend = useMemo(() => {
    if (data.length < 2) return 'neutral';
    const first = data[0].desviacion;
    const last = data[data.length - 1].desviacion;
    if (last > first + 5) return 'improving';
    if (last < first - 5) return 'declining';
    return 'neutral';
  }, [data]);

  const TrendIcon = deviationTrend === 'improving' ? TrendingUp : deviationTrend === 'declining' ? TrendingDown : Minus;
  const trendColor = deviationTrend === 'improving' ? 'text-green-600' : deviationTrend === 'declining' ? 'text-red-600' : 'text-gray-500';
  const trendLabel = deviationTrend === 'improving' ? 'Mejorando' : deviationTrend === 'declining' ? 'Empeorando' : 'Estable';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-purple-600" />
          <h3 className="text-base font-bold text-gray-900">Desviación vs Baremo 50 días</h3>
        </div>
        <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
          <TrendIcon size={14} />
          <span>{trendLabel}</span>
        </div>
      </div>

      {patient && !showGlobal && (
        <div className="mb-3 px-3 py-2 bg-blue-50 rounded-lg">
          <span className="text-sm text-blue-800 font-medium">Paciente: {patient.name}</span>
          <span className="text-xs text-blue-600 ml-2">| ROM objetivo: 90°</span>
        </div>
      )}

      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="day" 
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              label={{ value: 'Día', position: 'bottom', fill: '#9CA3AF', fontSize: 11 }}
            />
            <YAxis 
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              label={{ value: 'ROM (°)', angle: -90, fill: '#9CA3AF', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            />
            <Legend />
            <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="4 4" />
            <Line 
              type="monotone" 
              dataKey="paciente" 
              stroke="#2563EB" 
              strokeWidth={2.5}
              dot={{ r: 4 }}
              name="Paciente"
            />
            <Line 
              type="monotone" 
              dataKey="objetivo" 
              stroke="#EF4444" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Objetivo (baremo)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <span className="text-xs text-gray-500 block">Última desviación</span>
          <span className={`font-bold ${latestDeviation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {latestDeviation >= 0 ? '+' : ''}{latestDeviation}°
          </span>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <span className="text-xs text-gray-500 block">ROM actual</span>
          <span className="font-bold text-gray-900">
            {data.length > 0 ? data[data.length - 1].paciente : '--'}°
          </span>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <span className="text-xs text-gray-500 block">Objetivo día 50</span>
          <span className="font-bold text-gray-900">90°</span>
        </div>
      </div>
    </div>
  );
}
