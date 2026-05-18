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
 * Hard-gated to non-production: the page returns 404 in production builds.
 * No DB writes, no rep counting — purely a sanity tool.
 */
export default function CalibrationPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <CalibrationView />;
}
