import { describe, it, expect } from 'vitest';
import {
  createJointRepCounter,
  updateJointRepCounter,
  classifyRepQuality,
  type CompletedJointRep,
  type FrameQuality,
  type JointRepCounter,
} from '@/lib/hand-tracking';

/**
 * Drive a counter through a sequence of (angle, jointAnglesByName?, frameQuality?)
 * tuples and return the list of CompletedJointRep emitted along the way.
 */
function drive(
  series: Array<{ angle: number; joints?: Partial<Record<'MCP' | 'PIP' | 'DIP' | 'wrist', number>>; quality?: FrameQuality }>,
  opts?: Parameters<typeof createJointRepCounter>[0],
): { final: JointRepCounter; reps: CompletedJointRep[] } {
  let c = createJointRepCounter(opts);
  const reps: CompletedJointRep[] = [];
  for (const step of series) {
    c = updateJointRepCounter(c, step.angle, step.joints, step.quality);
    if (c.completedRep) reps.push(c.completedRep);
  }
  return { final: c, reps };
}

/** Build a flex/extend cycle with a given peak. Each cycle = 30 frames. */
function cycle(peak: number, frames = 30): number[] {
  const out: number[] = [];
  const half = frames / 2;
  for (let i = 0; i < half; i++) out.push((peak * i) / (half - 1));
  for (let i = 0; i < half; i++) out.push(peak * (1 - i / (half - 1)));
  return out;
}

describe('updateJointRepCounter — rep counting', () => {
  it('counts exactly N reps for N flex/extend cycles above the entry threshold', () => {
    const N = 4;
    const series: Array<{ angle: number }> = [];
    for (let i = 0; i < N; i++) {
      // Open frames at start to anchor "open" state.
      for (let k = 0; k < 5; k++) series.push({ angle: 0 });
      for (const a of cycle(70)) series.push({ angle: a });
      for (let k = 0; k < 5; k++) series.push({ angle: 0 });
    }
    const { reps, final } = drive(series);
    expect(final.repCount).toBe(N);
    expect(reps).toHaveLength(N);
    reps.forEach((r, i) => expect(r.repNumber).toBe(i + 1));
  });

  it('does not count a cycle that fails to cross flexionEnter', () => {
    // Peak 30°, threshold 35°: never opens a rep.
    const series = [
      ...Array(5).fill({ angle: 0 }),
      ...cycle(30).map((angle) => ({ angle })),
      ...Array(5).fill({ angle: 0 }),
    ];
    const { reps, final } = drive(series);
    expect(final.repCount).toBe(0);
    expect(reps).toHaveLength(0);
  });

  it('captures per-joint peaks across MCP / PIP / DIP', () => {
    const series: Array<{ angle: number; joints: { MCP: number; PIP: number; DIP: number } }> = [];
    for (let k = 0; k < 5; k++) series.push({ angle: 0, joints: { MCP: 0, PIP: 0, DIP: 0 } });
    const path = cycle(70);
    for (const a of path) {
      // PIP peaks higher than MCP, DIP peaks lower — typical clinical pattern.
      series.push({ angle: a, joints: { MCP: a, PIP: a * 1.2, DIP: a * 0.8 } });
    }
    for (let k = 0; k < 5; k++) series.push({ angle: 0, joints: { MCP: 0, PIP: 0, DIP: 0 } });

    const { reps } = drive(series);
    expect(reps).toHaveLength(1);
    const peaks = reps[0].peaks;
    expect(peaks.MCP?.peakFlex).toBeGreaterThanOrEqual(65);
    // PIP target 84 ≈ Math.round(70 * 1.2)
    expect(peaks.PIP?.peakFlex).toBeGreaterThanOrEqual(80);
    // DIP target 56 ≈ Math.round(70 * 0.8)
    expect(peaks.DIP?.peakFlex).toBeGreaterThanOrEqual(54);
  });

  it('hysteresis: tiny oscillations near flexionEnter do not double-count', () => {
    // First, properly enter a rep.
    const series: Array<{ angle: number }> = [];
    for (let k = 0; k < 5; k++) series.push({ angle: 0 });
    for (let k = 0; k < 6; k++) series.push({ angle: 60 });
    // Now oscillate around the enter threshold without coming below the exit
    // threshold (10°). The state machine should stay in 'flexed'.
    for (let k = 0; k < 20; k++) series.push({ angle: 30 + (k % 2 === 0 ? 8 : -8) });
    // Eventually fully extend → close one rep.
    for (let k = 0; k < 8; k++) series.push({ angle: 0 });

    const { reps, final } = drive(series);
    expect(final.repCount).toBe(1);
    expect(reps).toHaveLength(1);
  });

  it('respects custom thresholds', () => {
    const series: Array<{ angle: number }> = [];
    for (let k = 0; k < 5; k++) series.push({ angle: 0 });
    for (const a of cycle(55)) series.push({ angle: a });
    for (let k = 0; k < 5; k++) series.push({ angle: 0 });

    // Default thresholds (35/10) → counts.
    const def = drive(series).final.repCount;
    expect(def).toBe(1);

    // Higher entry (60) → does not count (peak only 55).
    const high = drive(series, { flexionEnter: 60, flexionExit: 15 }).final.repCount;
    expect(high).toBe(0);
  });

  it('captures quality breakdown on the completed rep', () => {
    const series: Array<{ angle: number; quality?: FrameQuality }> = [];
    for (let k = 0; k < 5; k++) series.push({ angle: 0, quality: { detected: true, handednessScore: 0.95 } });
    for (const a of cycle(70)) {
      // Drop ~10% of frames to keep this rep "clean" but with some missing.
      const detected = Math.random() > 0.1;
      series.push({ angle: a, quality: { detected, handednessScore: 0.95 } });
    }
    for (let k = 0; k < 5; k++) series.push({ angle: 0, quality: { detected: true, handednessScore: 0.95 } });

    const { reps } = drive(series);
    expect(reps).toHaveLength(1);
    expect(reps[0].quality.framesTotal).toBeGreaterThan(0);
    expect(['clean', 'low_visibility', 'partial', 'low_confidence']).toContain(reps[0].quality.flag);
  });
});

describe('classifyRepQuality — flag heuristics', () => {
  it('returns partial on an empty array', () => {
    expect(classifyRepQuality([]).flag).toBe('partial');
  });

  it('returns clean when every frame is detected at high confidence', () => {
    const frames: FrameQuality[] = Array.from({ length: 20 }, () => ({
      detected: true,
      handednessScore: 0.95,
      visibilityScore: 0.9,
    }));
    expect(classifyRepQuality(frames).flag).toBe('clean');
  });

  it('returns partial when more than 50% of frames are missing', () => {
    const frames: FrameQuality[] = [
      ...Array.from({ length: 11 }, () => ({ detected: false } as FrameQuality)),
      ...Array.from({ length: 9 }, () => ({ detected: true, handednessScore: 0.95 } as FrameQuality)),
    ];
    expect(classifyRepQuality(frames).flag).toBe('partial');
  });

  it('returns low_visibility for 30%–50% missing frames', () => {
    const frames: FrameQuality[] = [
      ...Array.from({ length: 8 }, () => ({ detected: false } as FrameQuality)),
      ...Array.from({ length: 12 }, () => ({ detected: true, handednessScore: 0.95 } as FrameQuality)),
    ];
    // 8/20 = 40% missing → low_visibility.
    expect(classifyRepQuality(frames).flag).toBe('low_visibility');
  });

  it('returns low_visibility when visibility score is under floor', () => {
    const frames: FrameQuality[] = [
      ...Array.from({ length: 8 }, () => ({ detected: true, visibilityScore: 0.2, handednessScore: 0.95 } as FrameQuality)),
      ...Array.from({ length: 12 }, () => ({ detected: true, visibilityScore: 0.9, handednessScore: 0.95 } as FrameQuality)),
    ];
    expect(classifyRepQuality(frames).flag).toBe('low_visibility');
  });

  it('returns low_confidence when handedness avg is below 0.7 and frames are otherwise present', () => {
    const frames: FrameQuality[] = Array.from({ length: 20 }, () => ({
      detected: true,
      handednessScore: 0.55,
      visibilityScore: 0.9,
    }));
    expect(classifyRepQuality(frames).flag).toBe('low_confidence');
  });

  it('prefers worse flag when multiple apply (partial > low_visibility > low_confidence)', () => {
    const frames: FrameQuality[] = [
      ...Array.from({ length: 12 }, () => ({ detected: false, handednessScore: 0.4 } as FrameQuality)),
      ...Array.from({ length: 8 }, () => ({ detected: true, handednessScore: 0.4, visibilityScore: 0.9 } as FrameQuality)),
    ];
    // 12/20 = 60% missing AND avg confidence 0.4 → partial wins.
    expect(classifyRepQuality(frames).flag).toBe('partial');
  });

  it('framesMissing matches the count of !detected || visibility < floor frames', () => {
    const frames: FrameQuality[] = [
      { detected: true, visibilityScore: 0.9 },
      { detected: false },
      { detected: true, visibilityScore: 0.1 }, // below floor
      { detected: true, visibilityScore: 0.9 },
    ];
    const r = classifyRepQuality(frames);
    expect(r.framesTotal).toBe(4);
    expect(r.framesMissing).toBe(2);
  });

  it('treats absent visibilityScore as visible (trusts detected)', () => {
    const frames: FrameQuality[] = Array.from({ length: 10 }, () => ({
      detected: true,
      handednessScore: 0.95,
    }));
    expect(classifyRepQuality(frames).flag).toBe('clean');
  });
});
