'use client';

import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ProgressionResponse } from '@/lib/doctor-api';

type Props = {
  data: ProgressionResponse | null;
};

/**
 * One iOS-blue colour ramp shared between joints. Order matches the most
 * common joints in the Fase 1 catalog (wrist + finger MCP/PIP/DIP).
 *
 * We deliberately stick to the brand blue family: clinical context favours
 * legibility and one shared palette over rainbow charts. Tooltip carries the
 * joint label so colour ambiguity is not a UX problem.
 */
const JOINT_COLORS: Record<string, string> = {
  wrist: '#007AFF',
  MCP: '#0A84FF',
  PIP: '#5AC8FA',
  DIP: '#0040A8',
};

const FALLBACK_COLOR = '#007AFF';

const Y_AXIS_CAP = 110;

type ChartRow = {
  day: string;
  // Each joint contributes a `<joint>_flex` and optional `<joint>_ext` field.
  [key: string]: number | string | null;
};

function colorForJoint(joint: string, idx: number): string {
  return JOINT_COLORS[joint] ?? FALLBACK_COLOR ?? `hsl(${(idx * 53) % 360} 70% 45%)`;
}

function formatDayLabel(day: string): string {
  try {
    return format(parseISO(day), 'dd/MM');
  } catch {
    return day;
  }
}

function formatTooltipDay(day: string): string {
  try {
    return format(parseISO(day), "d 'de' LLLL", { locale: es });
  } catch {
    return day;
  }
}

export function ProgressionChart({ data }: Props) {
  const series = data?.series ?? [];
  const hasAnyPoints = series.some((s) => s.points.length > 0);

  const { chartData, joints, hasExtension, yMax, xTickInterval } = useMemo(() => {
    // Merge per-joint points into a single row keyed by day so Recharts can
    // render multiple lines on the same X axis.
    const dayMap = new Map<string, ChartRow>();
    let maxValue = 0;
    let extensionPresent = false;

    for (const s of series) {
      for (const p of s.points) {
        const row = dayMap.get(p.day) ?? { day: p.day };
        if (p.max_flexion != null) {
          row[`${s.joint}_flex`] = p.max_flexion;
          if (p.max_flexion > maxValue) maxValue = p.max_flexion;
        }
        if (p.max_extension != null && p.max_extension > 0) {
          // Hyperextension is reported as a positive number; we plot it on
          // the negative half so it visually subtracts from the resting line.
          row[`${s.joint}_ext`] = -p.max_extension;
          extensionPresent = true;
        }
        dayMap.set(p.day, row);
      }
    }

    const sorted = Array.from(dayMap.values()).sort((a, b) =>
      (a.day as string).localeCompare(b.day as string),
    );

    const cap = Math.min(Y_AXIS_CAP, Math.max(20, Math.ceil(maxValue / 10) * 10));

    // For wide windows, only label every 3rd tick to avoid crowding.
    const interval = sorted.length > 30 ? 2 : 0;

    return {
      chartData: sorted,
      joints: series.map((s) => s.joint),
      hasExtension: extensionPresent,
      yMax: cap,
      xTickInterval: interval,
    };
  }, [series]);

  if (!data || !hasAnyPoints) {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-100 p-6 text-center">
        <p className="text-sm text-gray-600">
          Aún no hay datos de movimiento. Llegarán cuando el paciente complete su primera sesión.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Mobile (default) chart */}
      <div className="sm:hidden h-55">
        <ChartInner
          data={chartData}
          joints={joints}
          hasExtension={hasExtension}
          yMax={yMax}
          xTickInterval={xTickInterval}
        />
      </div>
      {/* Desktop chart */}
      <div className="hidden sm:block h-80">
        <ChartInner
          data={chartData}
          joints={joints}
          hasExtension={hasExtension}
          yMax={yMax}
          xTickInterval={xTickInterval}
        />
      </div>
    </div>
  );
}

function ChartInner({
  data,
  joints,
  hasExtension,
  yMax,
  xTickInterval,
}: {
  data: ChartRow[];
  joints: string[];
  hasExtension: boolean;
  yMax: number;
  xTickInterval: number;
}) {
  const yMin = hasExtension ? -20 : 0;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
        <defs>
          {joints.map((joint, idx) => {
            const color = colorForJoint(joint, idx);
            return (
              <linearGradient key={joint} id={`gradient-${joint}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={color} stopOpacity={0.55} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F2" vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={formatDayLabel}
          interval={xTickInterval}
          stroke="#9CA3AF"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: '#E5E7EB' }}
        />
        <YAxis
          domain={[yMin, yMax]}
          stroke="#9CA3AF"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: '#E5E7EB' }}
          tickFormatter={(v) => `${v}°`}
          width={42}
        />
        <Tooltip
          contentStyle={{
            background: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 12,
            fontSize: 12,
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
          }}
          labelFormatter={(value) => formatTooltipDay(String(value))}
          formatter={(value, name) => {
            const num = typeof value === 'number' ? value : Number(value);
            const [joint, kind] = String(name).split('|');
            const display =
              kind === 'ext' ? `${Math.abs(num)}° ext` : `${num}° flex`;
            return [display, joint];
          }}
        />
        <Legend
          verticalAlign="top"
          height={28}
          iconType="circle"
          wrapperStyle={{ fontSize: 12, paddingBottom: 4 }}
        />
        {joints.map((joint, idx) => {
          const color = colorForJoint(joint, idx);
          return (
            <Line
              key={`${joint}-flex`}
              type="monotone"
              dataKey={`${joint}_flex`}
              name={`${joint}|flex`}
              stroke={`url(#gradient-${joint})`}
              strokeWidth={2.5}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={false}
            />
          );
        })}
        {hasExtension &&
          joints.map((joint, idx) => {
            const color = colorForJoint(joint, idx);
            return (
              <Line
                key={`${joint}-ext`}
                type="monotone"
                dataKey={`${joint}_ext`}
                name={`${joint}|ext`}
                stroke={color}
                strokeOpacity={0.4}
                strokeDasharray="4 3"
                strokeWidth={1.5}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            );
          })}
      </LineChart>
    </ResponsiveContainer>
  );
}
