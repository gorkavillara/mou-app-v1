import { notFound } from 'next/navigation';
import { CalibrationView } from './CalibrationView';

/**
 * IA-04 — `/dev/calibration` developer-only page.
 *
 * Live MediaPipe feed with raw + normalized angles for every joint of every
 * finger, plus a wrist read-out. Used in consulta with Javi + goniómetro to
 * fill in the empirical values in `JOINT_CALIBRATION` (see
 * `docs/obsidian-vault/12-Convencion-angular.md`).
 *
 * Secret-key gate (env-driven, NOT NODE_ENV-driven):
 *   - `CALIBRATION_KEY` unset/empty  → page is open (local-dev default; nobody
 *     sets the var locally so the tool keeps working as before).
 *   - `CALIBRATION_KEY` set          → request must carry `?key=<value>`
 *     exactly equal to it (the deployed/Vercel case). Missing/wrong → 404.
 * The presence of the env var is the switch, which makes the prod path
 * testable locally just by setting the var.
 *
 * No DB writes, no rep counting — purely a sanity tool.
 */
export default async function CalibrationPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string | string[] }>;
}) {
  const expectedKey = process.env.CALIBRATION_KEY;

  if (expectedKey) {
    const { key } = await searchParams;
    const provided = Array.isArray(key) ? key[0] : key;
    // Internal calibration tool, not an auth boundary — a plain strict
    // comparison is fine (no need for a timing-safe compare).
    if (provided !== expectedKey) {
      notFound();
    }
  }

  return <CalibrationView />;
}
