/**
 * Goniometer-referenced calibration from photos (OPS-1 / IA-17).
 *
 * Takes the photo set in `docs/mou-dev/calibration/photos.json` — each photo is
 * one hand posture whose TRUE clinical angle was measured with a physical
 * goniometer — runs the app's own MediaPipe pipeline over it in IMAGE mode, and
 * fits `clinical = m · raw + b` per joint by least squares. From that line it
 * derives the `measuredOpen` / `measuredClosed` pair that `JOINT_CALIBRATION`
 * needs:
 *
 *   measuredOpen   = raw reading that maps to   0° clinical  = (0 − b) / m
 *   measuredClosed = raw reading that maps to max° clinical  = (max − b) / m
 *
 * Geometry comes from `calculateJointAngles` in src/lib/hand-tracking.ts — the
 * SAME function the exercise session uses — so the fit cannot drift from what
 * the product measures.
 *
 * Usage:
 *   npx tsx scripts/calibrate-from-photos.ts
 *   npx tsx scripts/calibrate-from-photos.ts --json out.json
 *   npx tsx scripts/calibrate-from-photos.ts --overlays   # evidencia visual
 *   npx tsx scripts/calibrate-from-photos.ts --dir <otro set de fotos>
 *
 * Requires network (MediaPipe wasm + model come from the same CDNs as the app)
 * and a Playwright chromium (`npx playwright install chromium`).
 */

import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// From @playwright/test (not the bare `playwright` alpha that @playwright/cli
// pulls in) so this uses the SAME chromium build as the e2e suite.
import { chromium } from '@playwright/test';

import {
  FINGERS,
  JOINT_CALIBRATION,
  calculateJointAngles,
  normalizeJointAngle,
  type FingerConfig,
  type FingerName,
  type HandChirality,
  type JointName,
  type Point,
} from '../src/lib/hand-tracking';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PORT = 4321;

/** `--dir <path>` points the run at another photo set (same layout). */
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const PHOTO_DIR = resolve(flag('--dir') ?? join(REPO, 'docs', 'mou-dev', 'calibration'));

/**
 * Landmark chain [proximal, vertex, distal] whose two segments form each joint.
 * Mirrors the vectors `calculateJointAngles` uses, so the overlay cannot drift
 * from the measurement it illustrates.
 */
const JOINT_CHAIN: Record<'MCP' | 'PIP' | 'DIP', (f: FingerConfig) => number[]> = {
  MCP: (f) => [0, f.mcpIndex, f.pipIndex],
  PIP: (f) => [f.mcpIndex, f.pipIndex, f.dipIndex],
  DIP: (f) => [f.pipIndex, f.dipIndex, f.tipIndex],
};

/** The surgeon labels thumb joints MP/IP; the lib indexes them PIP/DIP. */
const THUMB_JOINT_ALIAS: Record<string, JointName> = { MP: 'PIP', IP: 'DIP' };

type PhotoSpec = {
  file: string;
  finger: FingerName;
  /** MCP | PIP | DIP for long fingers; MP | IP for the thumb (surgeon labels). */
  joint: string;
  /** True angle measured with the goniometer, in clinical degrees. */
  clinical: number;
  caption: string;
};

type Detection = {
  attempt: string | null;
  landmarks: Point[] | null;
  handedness: { categoryName?: string; score?: number } | null;
  imageW: number;
  imageH: number;
};

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
};

/** Least-squares fit of y = m·x + b, plus R² and residual stats. */
function fitLine(points: Array<{ x: number; y: number }>) {
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
  const sxy = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0);
  const m = sxy / sxx;
  const b = meanY - m * meanX;
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const residuals = points.map((p) => p.y - (m * p.x + b));
  const ssRes = residuals.reduce((s, r) => s + r * r, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  const absRes = residuals.map(Math.abs);
  return {
    m,
    b,
    r2,
    residuals,
    meanAbsError: absRes.reduce((s, r) => s + r, 0) / n,
    maxAbsError: Math.max(...absRes),
  };
}

const round = (v: number, d = 1) => Number(v.toFixed(d));

async function main() {
  const spec = JSON.parse(await readFile(join(PHOTO_DIR, 'photos.json'), 'utf8')) as {
    source: string;
    photos: PhotoSpec[];
  };

  // --- serve the page + photos (module imports need a real origin) ---
  const server = createServer(async (req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const path = rel.startsWith('/photos/')
      ? join(PHOTO_DIR, rel)
      : join(HERE, 'calibration', rel);
    try {
      const body = await readFile(path);
      res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise<void>((r) => server.listen(PORT, r));

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('  [browser]', m.text());
  });

  await page.goto(`http://localhost:${PORT}/photo-landmarks.html`);
  await page.waitForFunction('window.__mpReady === true || window.__mpError', null, {
    timeout: 180_000,
  });
  const bootError = await page.evaluate('window.__mpError ?? null');
  if (bootError) throw new Error(`MediaPipe no arrancó: ${bootError}`);
  console.log(`MediaPipe listo · ${spec.photos.length} fotos · fuente: ${spec.source}\n`);

  // --- detect + measure ---
  type Sample = PhotoSpec & {
    libJoint: JointName;
    attempt: string | null;
    raw: number | null;
    handedness: string | null;
    landmarks: Point[] | null;
  };

  const samples: Sample[] = [];
  for (const photo of spec.photos) {
    const det = (await page.evaluate(
      (u) => (window as unknown as { __detect: (u: string) => Promise<Detection> }).__detect(u),
      `http://localhost:${PORT}/photos/${photo.file}`,
    )) as Detection;

    const libJoint =
      photo.finger === 'pulgar'
        ? (THUMB_JOINT_ALIAS[photo.joint] ?? (photo.joint as JointName))
        : (photo.joint as JointName);

    const fingerConfig = FINGERS.find((f) => f.name === photo.finger)!;
    // Pass the detected chirality: without it the sign of every reading is a
    // function of how the hand was presented to the lens, not of anatomy.
    const chirality = det.handedness?.categoryName as HandChirality | undefined;
    const raw = det.landmarks
      ? calculateJointAngles(det.landmarks, fingerConfig, chirality)[
          libJoint as 'MCP' | 'PIP' | 'DIP'
        ]
      : null;

    samples.push({
      ...photo,
      libJoint,
      attempt: det.attempt,
      raw,
      handedness: det.handedness?.categoryName ?? null,
      landmarks: det.landmarks,
    });

    console.log(
      `  ${photo.file.padEnd(20)} ${String(photo.clinical).padStart(3)}° goniómetro → ` +
        (raw === null
          ? 'SIN MANO DETECTADA'
          : `${round(raw).toString().padStart(7)}° crudo (${det.attempt}, ${chirality ?? '?'})`),
    );
  }

  // --- optional visual evidence: what was measured, drawn on each photo ---
  // `--overlays` writes one PNG per photo showing the two bone segments, the
  // vertex arc and the numbers, so the surgeon can confirm the tool measures
  // where he placed the goniometer instead of taking the figure on trust.
  if (process.argv.includes('--overlays')) {
    const outDir = join(PHOTO_DIR, 'overlays');
    await mkdir(outDir, { recursive: true });
    console.log('\nGenerando overlays…');
    for (const s of samples) {
      const cfg = FINGERS.find((f) => f.name === s.finger)!;
      const chain = JOINT_CHAIN[s.libJoint as 'MCP' | 'PIP' | 'DIP'](cfg);
      const labels = [
        `${s.caption}  ·  dedo ${s.finger}, ${s.joint}`,
        s.raw === null
          ? 'sin detección'
          : `goniómetro ${s.clinical}°  ·  crudo ${round(s.raw)}°  ·  normalizado ${round(
              normalizeJointAngle(s.raw, s.libJoint),
            )}°`,
      ];
      const dataUrl = (await page.evaluate(
        ([u, c, l]) =>
          (
            window as unknown as {
              __overlay: (u: string, c: number[], l: string[]) => Promise<string>;
            }
          ).__overlay(u as string, c as number[], l as string[]),
        [`http://localhost:${PORT}/photos/${s.file}`, chain, labels] as const,
      )) as string;
      await writeFile(join(outDir, s.file), Buffer.from(dataUrl.split(',')[1], 'base64'));
    }
    console.log(`  ${samples.length} overlays en ${outDir}`);
  }

  await browser.close();
  server.close();

  // --- fit per joint, long fingers only (the thumb is a different kinematic
  //     chain and is out of scope for Fase 1; it is reported, not fitted in) ---
  const report: Record<string, unknown> = { source: spec.source, generatedAt: new Date().toISOString() };
  const fits: Record<string, ReturnType<typeof fitLine> & {
    measuredOpen: number;
    measuredClosed: number;
    clinicalMax: number;
    n: number;
  }> = {};

  for (const joint of ['MCP', 'PIP', 'DIP'] as const) {
    const points = samples.filter(
      (s) => s.finger !== 'pulgar' && s.libJoint === joint && s.raw !== null,
    );
    if (points.length < 2) {
      console.log(`\n${joint}: sólo ${points.length} punto(s) válido(s) — no se puede ajustar.`);
      continue;
    }
    const fit = fitLine(points.map((p) => ({ x: p.raw!, y: p.clinical })));
    const clinicalMax = JOINT_CALIBRATION[joint].clinicalMax;
    const measuredOpen = (0 - fit.b) / fit.m;
    const measuredClosed = (clinicalMax - fit.b) / fit.m;
    fits[joint] = { ...fit, measuredOpen, measuredClosed, clinicalMax, n: points.length };

    console.log(`\n${joint} · ${points.length} puntos (${points.map((p) => p.finger).join(', ')})`);
    console.log(`  recta:  clínico = ${round(fit.m, 4)} · crudo ${fit.b >= 0 ? '+' : '−'} ${round(Math.abs(fit.b), 2)}`);
    console.log(`  R² = ${round(fit.r2, 4)} · error medio ${round(fit.meanAbsError)}° · máx ${round(fit.maxAbsError)}°`);
    console.log(`  measuredOpen = ${round(measuredOpen)}  measuredClosed = ${round(measuredClosed)}  (clinicalMax ${clinicalMax}°)`);
    points.forEach((p, i) => {
      console.log(
        `    ${p.file.padEnd(20)} crudo ${round(p.raw!).toString().padStart(7)}° → ` +
          `predicho ${round(fit.m * p.raw! + fit.b).toString().padStart(6)}° · real ${p.clinical}° · residuo ${round(fit.residuals[i])}°`,
      );
    });
  }

  console.log('\n--- bloque para JOINT_CALIBRATION ---');
  for (const [joint, f] of Object.entries(fits)) {
    const min = JOINT_CALIBRATION[joint as JointName].clinicalMin;
    console.log(
      `  ${joint.padEnd(6)}{ measuredOpen: ${round(f.measuredOpen)}, measuredClosed: ${round(f.measuredClosed)}, ` +
        `clinicalMax: ${f.clinicalMax}${min !== undefined ? `, clinicalMin: ${min}` : ''} },`,
    );
  }

  const thumb = samples.filter((s) => s.finger === 'pulgar');
  if (thumb.length) {
    console.log('\n--- pulgar (informativo, fuera de alcance Fase 1) ---');
    for (const t of thumb) {
      console.log(
        `  ${t.file.padEnd(20)} ${t.joint} (lib: ${t.libJoint}) ${String(t.clinical).padStart(3)}° → ` +
          (t.raw === null ? 'SIN MANO' : `${round(t.raw)}° crudo`),
      );
    }
  }

  report.samples = samples.map(({ landmarks, ...rest }) => ({ ...rest, hasLandmarks: !!landmarks }));
  report.fits = fits;
  report.landmarks = Object.fromEntries(samples.map((s) => [s.file, s.landmarks]));

  const jsonFlag = process.argv.indexOf('--json');
  const outPath =
    jsonFlag !== -1 && process.argv[jsonFlag + 1]
      ? resolve(process.argv[jsonFlag + 1])
      : join(PHOTO_DIR, 'calibration-report.json');
  await writeFile(outPath, JSON.stringify(report, null, 2));
  console.log(`\nInforme escrito en ${outPath}`);

  const missing = samples.filter((s) => s.raw === null);
  if (missing.length) {
    console.log(`\n⚠️  ${missing.length} foto(s) sin detección: ${missing.map((m) => m.file).join(', ')}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
