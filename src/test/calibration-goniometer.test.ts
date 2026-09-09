import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { JOINT_CALIBRATION, normalizeJointAngle, type JointName } from '@/lib/hand-tracking';

/**
 * Ties `JOINT_CALIBRATION` to the evidence it came from (OPS-1, 2026-09-09).
 *
 * `docs/mou-dev/calibration/` holds the surgeon's goniometer photo set — the
 * index finger held at 0° / 45° / 90° on each of MCP, PIP and DIP, each posture
 * measured with a physical goniometer — plus the report produced by
 * `npx tsx scripts/calibrate-from-photos.ts`.
 *
 * Two things must stay true and neither is checkable by reading the code alone:
 *
 *  1. The numbers shipped in `JOINT_CALIBRATION` are the ones the fit actually
 *     produced. Hand-editing a calibration value without re-running the fit is
 *     precisely the mistake that made the surgeon distrust the readings.
 *  2. Feeding the real measured angles back through `normalizeJointAngle`
 *     reproduces the goniometer truth within the vault's clinical gate
 *     (mean ≤ 10°, max ≤ 15°, per 12-Convencion-angular.md).
 *
 * If someone changes the calibration, this suite fails until the photo report
 * is regenerated — which is the point.
 */

type Fit = {
  measuredOpen: number;
  measuredClosed: number;
  clinicalMax: number;
  meanAbsError: number;
  maxAbsError: number;
  r2: number;
  n: number;
};

type Sample = {
  file: string;
  finger: string;
  libJoint: JointName;
  clinical: number;
  raw: number | null;
};

const REPORT_PATH = path.resolve(
  __dirname,
  '../../docs/mou-dev/calibration/calibration-report.json',
);

const report = JSON.parse(readFileSync(REPORT_PATH, 'utf8')) as {
  fits: Record<string, Fit>;
  samples: Sample[];
};

const FITTED_JOINTS = ['MCP', 'PIP', 'DIP'] as const;

/** The clinical acceptance gate from docs/mou-dev/12-Convencion-angular.md. */
const GATE_MEAN_DEG = 10;
const GATE_MAX_DEG = 15;

describe('JOINT_CALIBRATION provenance (goniometer photo set)', () => {
  it('every fitted joint is present in the committed report', () => {
    for (const joint of FITTED_JOINTS) {
      expect(report.fits[joint], `${joint} missing from the report`).toBeTruthy();
    }
  });

  it.each(FITTED_JOINTS)(
    '%s ships the measuredOpen/measuredClosed the fit produced',
    (joint) => {
      const fit = report.fits[joint];
      const cal = JOINT_CALIBRATION[joint];
      // The source is rounded to one decimal; allow only that.
      expect(cal.measuredOpen).toBeCloseTo(fit.measuredOpen, 1);
      expect(cal.measuredClosed).toBeCloseTo(fit.measuredClosed, 1);
      expect(cal.clinicalMax).toBe(fit.clinicalMax);
    },
  );

  it.each(FITTED_JOINTS)('%s was fitted on at least 3 goniometer points', (joint) => {
    expect(report.fits[joint].n).toBeGreaterThanOrEqual(3);
  });
});

describe('normalizeJointAngle against the goniometer truth', () => {
  /** Measured samples for one joint, long fingers only (the thumb is out of scope). */
  function samplesFor(joint: JointName): Sample[] {
    return report.samples.filter(
      (s) => s.finger !== 'pulgar' && s.libJoint === joint && typeof s.raw === 'number',
    );
  }

  it.each(FITTED_JOINTS)(
    '%s reproduces the goniometer within the clinical gate (mean ≤ 10°, max ≤ 15°)',
    (joint) => {
      const samples = samplesFor(joint);
      expect(samples.length).toBeGreaterThanOrEqual(3);

      const errors = samples.map((s) =>
        Math.abs(normalizeJointAngle(s.raw as number, joint) - s.clinical),
      );
      const mean = errors.reduce((a, b) => a + b, 0) / errors.length;
      const max = Math.max(...errors);

      expect(mean, `${joint} mean error ${mean.toFixed(1)}°`).toBeLessThanOrEqual(GATE_MEAN_DEG);
      expect(max, `${joint} max error ${max.toFixed(1)}°`).toBeLessThanOrEqual(GATE_MAX_DEG);
    },
  );

  it('flexion reads POSITIVE at every non-zero goniometer angle', () => {
    // The chirality fix in `calculateJointAngles` is what makes this hold: the
    // raw readings in the report are sign-normalized through the detected
    // handedness, so 45° and 90° of real flexion cannot come back negative.
    const flexed = report.samples.filter(
      (s) => s.finger !== 'pulgar' && s.clinical > 0 && typeof s.raw === 'number',
    );
    expect(flexed.length).toBeGreaterThan(0);
    for (const s of flexed) {
      expect(s.raw as number, `${s.file} read ${s.raw}° raw at ${s.clinical}° goniometer`)
        .toBeGreaterThan(0);
    }
  });
});
