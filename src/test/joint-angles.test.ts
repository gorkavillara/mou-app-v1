import { describe, it, expect } from 'vitest';
import {
  calculateJointAngles,
  calculateAllJointAngles,
  calculateWristAngle,
  normalizeJointAngle,
  normalizeFingerJointAngles,
  JOINT_CALIBRATION,
  FINGERS,
  type Point,
} from '@/lib/hand-tracking';

const indexFinger = FINGERS.find(f => f.name === 'indice')!;

/**
 * Build a deterministic 21-landmark hand where every finger lies straight along +y.
 * - Wrist at origin.
 * - All fingers (index, middle, ring, pinky) share the same x=0 column so wrist→MCP→PIP→DIP→TIP is a straight vertical line.
 * This makes wrist, MCP, PIP and DIP angles deterministically 0.
 */
function straightHandLandmarks(): Point[] {
  const lms: Point[] = Array(21).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));

  const setFinger = (mcpI: number, pipI: number, dipI: number, tipI: number) => {
    lms[mcpI] = { x: 0, y: 2, z: 0 };
    lms[pipI] = { x: 0, y: 3, z: 0 };
    lms[dipI] = { x: 0, y: 4, z: 0 };
    lms[tipI] = { x: 0, y: 5, z: 0 };
  };

  setFinger(5, 6, 7, 8);     // index
  setFinger(9, 10, 11, 12);  // middle
  setFinger(13, 14, 15, 16); // ring
  setFinger(17, 18, 19, 20); // pinky

  // thumb out of plane (not used by these tests).
  lms[1] = { x: -1, y: 0.5, z: 0 };
  lms[2] = { x: -1.5, y: 1, z: 0 };
  lms[3] = { x: -1.5, y: 1.5, z: 0 };
  lms[4] = { x: -1.5, y: 2, z: 0 };

  return lms;
}

/**
 * Index finger bent 90° at the MCP only.
 * MCP→PIP→DIP→TIP turns to point along +x while wrist→MCP stays along +y.
 */
function indexBent90AtMCP(): Point[] {
  const lms = straightHandLandmarks();
  lms[5] = { x: 0, y: 2, z: 0 };
  lms[6] = { x: 1, y: 2, z: 0 };
  lms[7] = { x: 2, y: 2, z: 0 };
  lms[8] = { x: 3, y: 2, z: 0 };
  return lms;
}

describe('calculateJointAngles', () => {
  it('returns near-zero on every joint when the finger is straight', () => {
    const j = calculateJointAngles(straightHandLandmarks(), indexFinger);
    expect(Math.abs(j.MCP)).toBeLessThan(1);
    expect(j.PIP).toBeLessThan(1);
    expect(j.DIP).toBeLessThan(1);
  });

  it('returns ~90° on MCP when the finger bends 90° at the base', () => {
    const j = calculateJointAngles(indexBent90AtMCP(), indexFinger);
    expect(Math.abs(Math.abs(j.MCP) - 90)).toBeLessThan(1);
    expect(j.PIP).toBeLessThan(1);
    expect(j.DIP).toBeLessThan(1);
  });
});

describe('calculateAllJointAngles', () => {
  it('returns MCP/PIP/DIP for every finger', () => {
    const all = calculateAllJointAngles(straightHandLandmarks());
    for (const f of FINGERS) {
      expect(all[f.name]).toHaveProperty('MCP');
      expect(all[f.name]).toHaveProperty('PIP');
      expect(all[f.name]).toHaveProperty('DIP');
    }
  });
});

describe('calculateWristAngle', () => {
  it('returns 0 when no forearm reference is provided', () => {
    expect(calculateWristAngle(straightHandLandmarks())).toBe(0);
  });

  it('returns near-zero when forearm, wrist and middle MCP are collinear', () => {
    const lms = straightHandLandmarks();
    const forearm: Point = { x: 0, y: -2, z: 0 };
    expect(Math.abs(calculateWristAngle(lms, forearm))).toBeLessThan(1);
  });

  it('returns ~90° when the hand is bent 90° relative to the forearm', () => {
    const lms = straightHandLandmarks();
    // middle MCP currently sits along +y from wrist; place forearm along -x so
    // the wrist→middleMCP and forearm→wrist vectors are perpendicular.
    const forearm: Point = { x: -2, y: 0, z: 0 };
    const a = calculateWristAngle(lms, forearm);
    expect(Math.abs(Math.abs(a) - 90)).toBeLessThan(1);
  });
});

describe('normalizeJointAngle', () => {
  it('maps measuredOpen to 0', () => {
    for (const j of ['wrist', 'MCP', 'PIP', 'DIP'] as const) {
      const cal = JOINT_CALIBRATION[j];
      expect(normalizeJointAngle(cal.measuredOpen, j)).toBeCloseTo(0, 5);
    }
  });

  it('maps measuredClosed to clinicalMax', () => {
    for (const j of ['wrist', 'MCP', 'PIP', 'DIP'] as const) {
      const cal = JOINT_CALIBRATION[j];
      expect(normalizeJointAngle(cal.measuredClosed, j)).toBeCloseTo(cal.clinicalMax, 5);
    }
  });

  it('clamps values above measuredClosed to clinicalMax', () => {
    expect(normalizeJointAngle(200, 'MCP')).toBeCloseTo(JOINT_CALIBRATION.MCP.clinicalMax, 5);
  });

  // 2026-06-06: under the unified slope, an input BELOW measuredOpen no longer
  // flattens to 0 — it extends linearly into the negative clinical band (down
  // to clinicalMin). MCP measuredOpen is 12.3, so 0 raw sits below the open
  // pose and reads slightly negative. Intent preserved: sub-open inputs resolve
  // smoothly, they are not discarded.
  it('maps a sub-measuredOpen MCP input below 0, not flattened to 0', () => {
    const r = normalizeJointAngle(0, 'MCP');
    expect(r).toBeLessThan(0);
    expect(r).toBeGreaterThanOrEqual(JOINT_CALIBRATION.MCP.clinicalMin!);
  });

  // 2026-06-06: unified-slope rewrite. The old BUG-4 tests asserted the
  // asymmetric negative-band pivot (normalize(-measuredOpen) ≈ clinicalMin).
  // That math is gone — a two-point calibration has exactly one slope. The
  // INTENT is preserved: a raw input MORE extended than the open pose must
  // resolve into the NEGATIVE clinical band (not flatten to 0), clamped at
  // clinicalMin. We assert that on the new unified formula + real values.
  it('maps measuredOpen to exactly 0 for every joint (new values)', () => {
    for (const j of ['wrist', 'MCP', 'PIP', 'DIP'] as const) {
      expect(normalizeJointAngle(JOINT_CALIBRATION[j].measuredOpen, j)).toBeCloseTo(0, 5);
    }
  });

  it('maps measuredClosed to clinicalMax for every joint (new values)', () => {
    for (const j of ['wrist', 'MCP', 'PIP', 'DIP'] as const) {
      const cal = JOINT_CALIBRATION[j];
      expect(normalizeJointAngle(cal.measuredClosed, j)).toBeCloseTo(cal.clinicalMax, 5);
    }
  });

  it('resolves negative PIP/DIP input into the negative clinical band, not 0', () => {
    // PIP measuredOpen is itself negative (−5.7). An input still MORE extended
    // than the open pose must land below 0 in clinical degrees.
    const pip = normalizeJointAngle(JOINT_CALIBRATION.PIP.measuredOpen - 5, 'PIP');
    const dip = normalizeJointAngle(JOINT_CALIBRATION.DIP.measuredOpen - 5, 'DIP');
    expect(pip).toBeLessThan(0);
    expect(pip).toBeGreaterThanOrEqual(JOINT_CALIBRATION.PIP.clinicalMin!);
    expect(dip).toBeLessThan(0);
    expect(dip).toBeGreaterThanOrEqual(JOINT_CALIBRATION.DIP.clinicalMin!);
  });

  it('a PIP input more extended than the open pose maps negative; a far one clamps at clinicalMin', () => {
    // −20 is more extended than measuredOpen (−5.7) but the linear map only
    // reaches ~−16°, still inside the band.
    const mild = normalizeJointAngle(-20, 'PIP');
    expect(mild).toBeLessThan(0);
    expect(mild).toBeGreaterThan(JOINT_CALIBRATION.PIP.clinicalMin!);
    // −40 maps past −30 linearly, so the lower clamp must hold it at clinicalMin.
    expect(normalizeJointAngle(-40, 'PIP')).toBeCloseTo(JOINT_CALIBRATION.PIP.clinicalMin!, 5);
  });

  it('returns 0 for a degenerate calibration (open === closed) instead of NaN/Infinity', () => {
    // The wrist 0/0 capture is the real-world trigger; simulate the degenerate
    // range directly so the guard is exercised regardless of the live config.
    const original = { ...JOINT_CALIBRATION.wrist };
    JOINT_CALIBRATION.wrist = { measuredOpen: 0, measuredClosed: 0, clinicalMax: 90, clinicalMin: -70 };
    try {
      const r = normalizeJointAngle(45, 'wrist');
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBe(0);
    } finally {
      JOINT_CALIBRATION.wrist = original;
    }
  });
});

// BUG-4 (2026-05-20): the surgeon operates extensor tendons and reported that
// interphalangeal EXTENSION was never measured. PIP/DIP previously returned
// magnitude only (always ≥ 0), so flexion and extension were indistinguishable
// and the negative region got clamped to 0. They must now carry a SIGN via the
// same 2D cross-product convention as MCP: bending one way and the opposite way
// produce opposite signs, and the extension side resolves through normalize.
describe('calculateJointAngles — interphalangeal extension sign (BUG-4)', () => {
  /** Index finger bent at the PIP toward +x (DIP/TIP curl forward). */
  function indexBentForwardAtPIP(): Point[] {
    const lms = straightHandLandmarks();
    lms[5] = { x: 0, y: 2, z: 0 };   // MCP
    lms[6] = { x: 0, y: 3, z: 0 };   // PIP
    lms[7] = { x: 1, y: 3, z: 0 };   // DIP curls toward +x
    lms[8] = { x: 2, y: 3, z: 0 };   // TIP continues
    return lms;
  }

  /** Index finger bent at the PIP toward -x — the OPPOSITE direction. */
  function indexBentBackwardAtPIP(): Point[] {
    const lms = straightHandLandmarks();
    lms[5] = { x: 0, y: 2, z: 0 };
    lms[6] = { x: 0, y: 3, z: 0 };
    lms[7] = { x: -1, y: 3, z: 0 };  // DIP curls toward -x
    lms[8] = { x: -2, y: 3, z: 0 };
    return lms;
  }

  it('produces OPPOSITE signs for the two bend directions (no longer magnitude-only)', () => {
    const fwd = calculateJointAngles(indexBentForwardAtPIP(), indexFinger).PIP;
    const back = calculateJointAngles(indexBentBackwardAtPIP(), indexFinger).PIP;
    // Both ~90° in magnitude, but opposite sign — the whole point of BUG-4.
    expect(Math.abs(Math.abs(fwd) - 90)).toBeLessThan(1);
    expect(Math.abs(Math.abs(back) - 90)).toBeLessThan(1);
    expect(Math.sign(fwd)).toBe(-Math.sign(back));
  });

  it('a finger bent BACKWARDS at the PIP (hyperextension) yields a NEGATIVE angle', () => {
    // Whichever direction is "flexion", the opposite (extension) is negative.
    // In this landmark frame the +x curl is the flexion side, so the -x curl
    // is the extension/hyperextension side and must read negative.
    const fwd = calculateJointAngles(indexBentForwardAtPIP(), indexFinger).PIP;
    const back = calculateJointAngles(indexBentBackwardAtPIP(), indexFinger).PIP;
    const flexion = fwd > 0 ? fwd : back;
    const extension = fwd > 0 ? back : fwd;
    expect(flexion).toBeGreaterThan(0);
    expect(extension).toBeLessThan(0);
  });

  it('the extension-side PIP angle normalizes into the negative clinical range, not 0', () => {
    const fwd = calculateJointAngles(indexBentForwardAtPIP(), indexFinger).PIP;
    const back = calculateJointAngles(indexBentBackwardAtPIP(), indexFinger).PIP;
    const extensionRaw = fwd < 0 ? fwd : back; // the negative one
    expect(extensionRaw).toBeLessThan(0);
    const norm = normalizeJointAngle(extensionRaw, 'PIP');
    expect(norm).toBeLessThan(0);
    expect(norm).toBeGreaterThanOrEqual(JOINT_CALIBRATION.PIP.clinicalMin!);
  });
});

describe('normalizeFingerJointAngles', () => {
  it('passes each joint through its own calibration', () => {
    const raw = {
      MCP: JOINT_CALIBRATION.MCP.measuredClosed,
      PIP: JOINT_CALIBRATION.PIP.measuredClosed,
      DIP: JOINT_CALIBRATION.DIP.measuredClosed,
    };
    const n = normalizeFingerJointAngles(raw);
    expect(n.MCP).toBeCloseTo(JOINT_CALIBRATION.MCP.clinicalMax, 5);
    expect(n.PIP).toBeCloseTo(JOINT_CALIBRATION.PIP.clinicalMax, 5);
    expect(n.DIP).toBeCloseTo(JOINT_CALIBRATION.DIP.clinicalMax, 5);
  });
});
