/**
 * Goniometer-referenced calibration from photos (OPS-1 / IA-17 / IA-24).
 *
 * Takes the photo set in `docs/mou-dev/calibration/photos.json` — each photo is
 * one hand posture whose TRUE clinical angle was measured with a physical
 * goniometer — runs the app's own MediaPipe pipeline over it in IMAGE mode and:
 *
 *  1. builds, per (finger group × joint), the piecewise-linear table that
 *     `JOINT_CALIBRATION` (long fingers) and `THUMB_CALIBRATION` need: one
 *     `{ raw, clinical }` point per goniometer posture (raw averaged when a
 *     posture has several photos);
 *  2. reads EVERY photo back through `normalizeJointAngle` with the calibration
 *     currently in the code and prints the error against the goniometer.
 *
 * Geometry comes from `toImagePixels` + `calculateJointAngles` in
 * src/lib/hand-tracking.ts — the SAME functions the exercise session uses — so
 * the table cannot drift from what the product measures.
 *
 * Usage:
 *   npx tsx scripts/calibrate-from-photos.ts
 *   npx tsx scripts/calibrate-from-photos.ts --check      # exit 1 si alguna foto se desvía > 0,5°
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
  calculateJointAngles,
  normalizeJointAngle,
  readViewSide,
  toImagePixels,
  type CalibrationPoint,
  type FingerConfig,
  type FingerName,
  type HandChirality,
  type JointName,
  type Point,
} from '../src/lib/hand-tracking';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PORT = 4321;

/** `--check` tolerance: the table is exact by construction, so only rounding. */
const CHECK_TOLERANCE_DEG = 0.5;

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

type Sample = PhotoSpec & {
  libJoint: JointName;
  attempt: string | null;
  raw: number | null;
  handedness: string | null;
  viewSide: string | null;
  landmarks: Point[] | null;
};

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
};

const round = (v: number, d = 1) => Number(v.toFixed(d));

const GROUPS = [
  { label: 'JOINT_CALIBRATION (dedos largos)', key: 'long', match: (s: Sample) => s.finger !== 'pulgar' },
  { label: 'THUMB_CALIBRATION', key: 'pulgar', match: (s: Sample) => s.finger === 'pulgar' },
];

/** One point per goniometer posture, raw averaged across its photos. */
function buildTable(samples: Sample[]): CalibrationPoint[] {
  const byClinical = new Map<number, number[]>();
  for (const s of samples) {
    if (s.raw === null) continue;
    byClinical.set(s.clinical, [...(byClinical.get(s.clinical) ?? []), s.raw]);
  }
  return [...byClinical.entries()]
    .map(([clinical, raws]) => ({ raw: round(raws.reduce((a, b) => a + b, 0) / raws.length, 2), clinical }))
    .sort((a, b) => a.clinical - b.clinical);
}

async function main(): Promise<number> {
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
    // Geometry in image pixels (aspect-true), signed with the detected
    // chirality and view side: without them the sign is a function of how the
    // hand was presented to the lens, not of anatomy.
    const chirality = det.handedness?.categoryName as HandChirality | undefined;
    const pixels = det.landmarks ? toImagePixels(det.landmarks, det.imageW, det.imageH) : null;
    const viewSide = pixels ? readViewSide(pixels) : null;
    const raw = pixels
      ? calculateJointAngles(pixels, fingerConfig, chirality, viewSide ?? undefined)[
          libJoint as 'MCP' | 'PIP' | 'DIP'
        ]
      : null;

    samples.push({
      ...photo,
      libJoint,
      attempt: det.attempt,
      raw,
      handedness: det.handedness?.categoryName ?? null,
      viewSide,
      landmarks: det.landmarks,
    });

    console.log(
      `  ${photo.file.padEnd(22)} ${String(photo.clinical).padStart(3)}° goniómetro → ` +
        (raw === null
          ? 'SIN MANO DETECTADA'
          : `${round(raw).toString().padStart(7)}° crudo (${det.attempt}, ${chirality ?? '?'}, ${viewSide ?? 'sin perfil'})`),
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
          : `goniómetro ${s.clinical}°  ·  crudo ${round(s.raw)}°  ·  motor ${round(
              normalizeJointAngle(s.raw, s.libJoint, s.finger),
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

  // --- calibration tables from this photo set ---
  const tables: Record<string, Partial<Record<JointName, CalibrationPoint[]>>> = {};
  for (const g of GROUPS) {
    const lines: string[] = [];
    for (const joint of ['MCP', 'PIP', 'DIP'] as const) {
      const points = buildTable(samples.filter((s) => g.match(s) && s.libJoint === joint));
      if (points.length === 0) continue;
      (tables[g.key] ??= {})[joint] = points;
      const monotonic = points.every((p, i) => i === 0 || p.raw > points[i - 1].raw);
      const literal = points.map((p) => `{ raw: ${p.raw}, clinical: ${p.clinical} }`).join(', ');
      lines.push(`  ${joint}: [${literal}]${monotonic ? '' : '   ⚠️ NO MONÓTONA: no utilizable'}`);
    }
    if (lines.length) console.log(`\n--- puntos para ${g.label} ---\n${lines.join('\n')}`);
  }

  // --- every photo read back through the calibration IN THE CODE ---
  console.log('\n--- lectura del motor con la calibración actual ---');
  let worst = 0;
  for (const s of samples) {
    if (s.raw === null) {
      console.log(`  ${s.file.padEnd(22)} SIN MANO`);
      worst = Infinity;
      continue;
    }
    const engine = normalizeJointAngle(s.raw, s.libJoint, s.finger);
    const error = engine - s.clinical;
    worst = Math.max(worst, Math.abs(error));
    console.log(
      `  ${s.file.padEnd(22)} goniómetro ${String(s.clinical).padStart(3)}° → motor ${round(engine)
        .toString()
        .padStart(6)}°   error ${error >= 0 ? '+' : ''}${round(error)}°`,
    );
  }
  console.log(`  peor error: ${round(worst)}°`);

  const report = {
    source: spec.source,
    generatedAt: new Date().toISOString(),
    tables,
    samples: samples.map(({ landmarks, ...rest }) => ({ ...rest, hasLandmarks: !!landmarks })),
    landmarks: Object.fromEntries(samples.map((s) => [s.file, s.landmarks])),
  };
  const jsonFlag = flag('--json');
  const outPath = jsonFlag ? resolve(jsonFlag) : join(PHOTO_DIR, 'calibration-report.json');
  await writeFile(outPath, JSON.stringify(report, null, 2));
  console.log(`\nInforme escrito en ${outPath}`);

  return worst;
}

main()
  .then((worst) => {
    if (process.argv.includes('--check') && worst > CHECK_TOLERANCE_DEG) {
      console.error(`\n✖ --check: alguna foto se desvía ${round(worst)}° (> ${CHECK_TOLERANCE_DEG}°)`);
      process.exit(1);
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
