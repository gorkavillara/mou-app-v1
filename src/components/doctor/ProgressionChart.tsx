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
import { FINGER_LABELS } from './FingerStatusPicker';
import type { FingerName } from '@/lib/database.types';

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
  // Each series contributes a `<key>_flex` and optional `<key>_ext` field.
  [key: string]: number | string | null;
};

// FB-3: a chart series is now (joint × finger). `key` is the stable, field-safe
// identifier used in chart rows/dataKeys; `label` is the human-readable legend
// text (e.g. "MCP · Índice", or just "MCP" for legacy finger-less rows).
type SeriesMeta = {
  key: string;
  label: string;
  joint: string;
};

function seriesKey(joint: string, finger: FingerName | null): string {
  return finger ? `${joint}__${finger}` : joint;
}

function seriesLabel(joint: string, finger: FingerName | null): string {
  return finger ? `${joint} · ${FINGER_LABELS[finger]}` : joint;
}

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

  const { chartData, seriesMeta, hasExtension, yMax, xTickInterval } = useMemo(() => {
    // Merge per-series (joint × finger) points into a single row keyed by day
    // so Recharts can render multiple lines on the same X axis.
    const dayMap = new Map<string, ChartRow>();
    const metaList: SeriesMeta[] = [];
    let maxValue = 0;
    let extensionPresent = false;

    for (const s of series) {
      const key = seriesKey(s.joint, s.finger);
      metaList.push({ key, label: seriesLabel(s.joint, s.finger), joint: s.joint });
      for (const p of s.points) {
        const row = dayMap.get(p.day) ?? { day: p.day };
        if (p.max_flexion != null) {
          row[`${key}_flex`] = p.max_flexion;
          if (p.max_flexion > maxValue) maxValue = p.max_flexion;
        }
        if (p.max_extension != null && p.max_extension !== 0) {
          // The session stores extension as a SIGNED NEGATIVE value and
          // patient_progression returns min(max_extension_deg) — so a real
          // extension excursion arrives here as a NEGATIVE number. (Older rows
          // may carry a positive magnitude.) Plot it on the negative half
          // regardless of the stored sign so the deficit is always visible —
          // the previous `> 0` test silently dropped every modern row.
          row[`${key}_ext`] = -Math.abs(p.max_extension);
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
      seriesMeta: metaList,
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
          seriesMeta={seriesMeta}
          hasExtension={hasExtension}
          yMax={yMax}
          xTickInterval={xTickInterval}
        />
      </div>
      {/* Desktop chart */}
      <div className="hidden sm:block h-80">
        <ChartInner
          data={chartData}
          seriesMeta={seriesMeta}
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
  seriesMeta,
  hasExtension,
  yMax,
  xTickInterval,
}: {
  data: ChartRow[];
  seriesMeta: SeriesMeta[];
  hasExtension: boolean;
  yMax: number;
  xTickInterval: number;
}) {
  const yMin = hasExtension ? -20 : 0;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
        <defs>
          {seriesMeta.map((m, idx) => {
            const color = colorForJoint(m.joint, idx);
            return (
              <linearGradient key={m.key} id={`gradient-${m.key}`} x1="0" y1="0" x2="0" y2="1">
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
            const [label, kind] = String(name).split('|');
            const display =
              kind === 'ext' ? `${Math.abs(num)}° ext` : `${num}° flex`;
            return [display, label];
          }}
        />
        <Legend
          verticalAlign="top"
          height={28}
          iconType="circle"
          wrapperStyle={{ fontSize: 12, paddingBottom: 4 }}
        />
        {seriesMeta.map((m, idx) => {
          const color = colorForJoint(m.joint, idx);
          return (
            <Line
              key={`${m.key}-flex`}
              type="monotone"
              dataKey={`${m.key}_flex`}
              name={`${m.label}|flex`}
              stroke={`url(#gradient-${m.key})`}
              strokeWidth={2.5}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={false}
            />
          );
        })}
        {hasExtension &&
          seriesMeta.map((m, idx) => {
            const color = colorForJoint(m.joint, idx);
            return (
              <Line
                key={`${m.key}-ext`}
                type="monotone"
                dataKey={`${m.key}_ext`}
                name={`${m.label}|ext`}
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
