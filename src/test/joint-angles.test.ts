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

  it('clamps positive values below measuredOpen to 0', () => {
    expect(normalizeJointAngle(0, 'MCP')).toBeCloseTo(0, 5);
  });

  // BUG-4 (2026-05-20): PIP/DIP now have a hyperextension/extension-deficit
  // bound (clinicalMin: -30). This test used to assert PIP/DIP flatten negative
  // input to 0; it was deliberately changed because the surgeon needs that
  // negative region resolved, not discarded.
  it('maps negative PIP/DIP input into the negative clinical range, not 0', () => {
    const pip = normalizeJointAngle(-JOINT_CALIBRATION.PIP.measuredOpen, 'PIP');
    const dip = normalizeJointAngle(-JOINT_CALIBRATION.DIP.measuredOpen, 'DIP');
    expect(pip).toBeCloseTo(JOINT_CALIBRATION.PIP.clinicalMin!, 5); // -30
    expect(dip).toBeCloseTo(JOINT_CALIBRATION.DIP.clinicalMin!, 5); // -30
    // A partial extension deficit maps proportionally into the negative band.
    const halfPip = normalizeJointAngle(-JOINT_CALIBRATION.PIP.measuredOpen / 2, 'PIP');
    expect(halfPip).toBeLessThan(0);
    expect(halfPip).toBeGreaterThan(JOINT_CALIBRATION.PIP.clinicalMin!);
  });

  it('maps -measuredOpen to clinicalMin for joints with hyperextension', () => {
    const cal = JOINT_CALIBRATION.wrist;
    expect(normalizeJointAngle(-cal.measuredOpen, 'wrist')).toBeCloseTo(cal.clinicalMin!, 5);
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
