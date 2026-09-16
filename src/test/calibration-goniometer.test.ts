import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  FINGERS,
  JOINT_CALIBRATION,
  THUMB_CALIBRATION,
  calculateJointAngles,
  normalizeJointAngle,
  toImagePixels,
  type CalibrationPoint,
  type FingerName,
  type HandChirality,
  type HandViewSide,
  type JointName,
  type Point,
} from '@/lib/hand-tracking';

/**
 * Ties the angle engine to the surgeon's goniometer photos (OPS-1, IA-24).
 *
 * `docs/mou-dev/calibration/` holds the 15 photos — index MCP/PIP/DIP at
 * 0°/45°/90° and thumb MP 0°/45°/55°, IP 0°/45°/80°, each posture measured with
 * a physical goniometer — plus the report written by
 * `npx tsx scripts/calibrate-from-photos.ts`, which carries the MediaPipe
 * landmarks detected on every photo.
 *
 * What must stay true, and cannot be checked by reading the code:
 *
 *  1. The geometry in the code still produces the raw readings in the report
 *     from the committed landmarks (nobody changed the maths behind the table).
 *  2. The tables shipped in `JOINT_CALIBRATION` / `THUMB_CALIBRATION` are the
 *     ones the photos produced (nobody hand-edited a number).
 *  3. EVERY photo reads back exactly its goniometer value through the engine.
 */

type Sample = {
  file: string;
  finger: FingerName;
  libJoint: JointName;
  clinical: number;
  width: number;
  height: number;
  raw: number | null;
  handedness: HandChirality | null;
  viewSide: HandViewSide | null;
};

const REPORT_PATH = path.resolve(
  __dirname,
  '../../docs/mou-dev/calibration/calibration-report.json',
);

const report = JSON.parse(readFileSync(REPORT_PATH, 'utf8')) as {
  tables: { long: Partial<Record<JointName, CalibrationPoint[]>>; pulgar: Partial<Record<JointName, CalibrationPoint[]>> };
  samples: Sample[];
  landmarks: Record<string, Point[] | null>;
};

/** The table is exact by construction; allow only the 2-decimal rounding of `raw`. */
const EXACT_TOLERANCE_DEG = 0.5;

const measured = report.samples.filter((s) => typeof s.raw === 'number');

describe('goniometer photo set', () => {
  it('has all 15 photos detected', () => {
    expect(report.samples).toHaveLength(15);
    expect(measured).toHaveLength(15);
  });

  it.each(measured.map((s) => [s.file, s] as const))(
    '%s: the code geometry reproduces the raw reading from its landmarks',
    (_file, s) => {
      const finger = FINGERS.find((f) => f.name === s.finger)!;
      const pixels = toImagePixels(report.landmarks[s.file]!, s.width, s.height);
      const raw = calculateJointAngles(pixels, finger, s.handedness ?? undefined, s.viewSide ?? undefined)[
        s.libJoint as 'MCP' | 'PIP' | 'DIP'
      ];
      expect(raw).toBeCloseTo(s.raw as number, 6);
    },
  );

  it('ships exactly the tables the photos produced', () => {
    for (const joint of ['MCP', 'PIP', 'DIP'] as const) {
      expect(JOINT_CALIBRATION[joint].points).toEqual(report.tables.long[joint]);
    }
    expect(THUMB_CALIBRATION.PIP?.points).toEqual(report.tables.pulgar.PIP);
    expect(THUMB_CALIBRATION.DIP?.points).toEqual(report.tables.pulgar.DIP);
  });

  it.each(measured.map((s) => [s.file, s.clinical, s] as const))(
    '%s: the engine reads the goniometer value (%i°)',
    (_file, clinical, s) => {
      const engine = normalizeJointAngle(s.raw as number, s.libJoint, s.finger);
      expect(Math.abs(engine - clinical)).toBeLessThanOrEqual(EXACT_TOLERANCE_DEG);
    },
  );

  it('flexion reads POSITIVE at every non-zero goniometer angle', () => {
    const flexed = measured.filter((s) => s.clinical > 0);
    expect(flexed.length).toBeGreaterThan(0);
    for (const s of flexed) {
      expect(s.raw as number, `${s.file} read ${s.raw}° raw at ${s.clinical}° goniometer`)
        .toBeGreaterThan(0);
    }
  });
});

/**
 * INDEPENDENT check — not used to build any table. Javi's first iPhone session
 * (2026-09-14, front camera, index MCP): with the old engine a straight finger
 * read +28° and a 90° MCP read −30°. The landmarks below are the ones the app
 * itself drew on screen in those two screenshots (dot centres fitted in the
 * 945×2048 screenshot; the canvas scales the video uniformly, so pixel angles
 * are preserved). The screen is a CSS mirror of what MediaPipe saw, so x is
 * flipped back. Chirality/view side are the ones reconstructed for that session
 * (right hand, little-finger edge to the camera — see 12-Convencion-angular).
 *
 * Not goniometer-measured ("0° y unos 90°" by eye) and the dot centres carry
 * ~1–2 px of fitting error, hence the looser bounds.
 */
describe("Javi's live iPhone session (independent of the calibration)", () => {
  const SCREEN_W = 945;
  function liveHand(dots: Record<number, [number, number]>): Point[] {
    const lms: Point[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
    for (const [i, [x, y]] of Object.entries(dots)) lms[Number(i)] = { x: SCREEN_W - x, y, z: 0 };
    return lms;
  }
  const index = FINGERS.find((f) => f.name === 'indice')!;
  const mcp = (dots: Record<number, [number, number]>) =>
    normalizeJointAngle(calculateJointAngles(liveHand(dots), index, 'Right', 'ulnar').MCP, 'MCP', 'indice');

  it('straight index reads ~0° (old engine: +28°)', () => {
    const v = mcp({ 0: [534.25, 1442.75], 5: [484.25, 1077.25], 6: [473.5, 933.0] });
    expect(Math.abs(v)).toBeLessThanOrEqual(5);
  });

  it('90° MCP reads ~90° (old engine: −30°)', () => {
    const v = mcp({ 0: [655.25, 1621.75], 5: [646.5, 1211.0], 6: [480.25, 1200.75] });
    expect(v).toBeGreaterThanOrEqual(85);
  });
});
