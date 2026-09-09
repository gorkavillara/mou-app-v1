import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * A camera stand-in that feeds MediaPipe REAL hands.
 *
 * The existing camera spec stubs `getUserMedia` with a canvas nobody draws to,
 * which is right for testing the "camera never starts" path but can never
 * exercise the measurement pipeline: MediaPipe finds no hand, so no angle, no
 * repetition, no session payload. That left the product's core — the thing the
 * surgeon actually judges it on — with no automated coverage at all.
 *
 * This helper instead paints the goniometer photos from
 * `docs/mou-dev/calibration/photos/` onto a canvas and publishes THAT as the
 * camera stream. They are genuine photographs of a hand whose true clinical
 * angle was measured with a physical goniometer, so the detector does real
 * work: landmarks, handedness, joint angles, hysteresis, rep counting and the
 * session POST all run exactly as they do for a patient.
 *
 * The test drives the posture with `window.__setPose('open' | 'fist')`;
 * alternating the two crosses the rep counter's flexion/extension thresholds.
 */

const PHOTO_DIR = path.resolve(__dirname, '../../docs/mou-dev/calibration/photos');

/**
 * Extended pose. Both `indice-MCP-000` and `indice-DIP-000` are the index held
 * straight, but rendered at this canvas size the first reads ~26° of normalized
 * MCP and the second ~3.5°. Only the second clears the rep counter's 10°
 * extension threshold, so a cycle built on the first never closes a repetition.
 *
 * (That ~22° spread between two photos of the same nominal 0° is itself the
 * MCP's known weak spot — its 2D reading is the one that only just passes the
 * clinical gate. See docs/mou-dev/12-Convencion-angular.md.)
 */
const OPEN_PHOTO = 'indice-DIP-000.png';
/** Fist — index MCP measured at 90° with the goniometer; reads ~87° here. */
const FIST_PHOTO = 'indice-MCP-090.png';

function dataUrl(file: string): string {
  const bytes = readFileSync(path.join(PHOTO_DIR, file));
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

/**
 * Builds the init script. The photos are inlined as data URIs because the app
 * has no route that serves the calibration set, and copying them into
 * `public/` would ship test fixtures with the product.
 */
export function fakeHandCameraScript(): string {
  const open = dataUrl(OPEN_PHOTO);
  const fist = dataUrl(FIST_PHOTO);

  return `
    (() => {
      const POSES = { open: ${JSON.stringify(open)}, fist: ${JSON.stringify(fist)} };
      // 960x720 keeps the hand well above the size MediaPipe needs; the source
      // crops are small WhatsApp images and detection degrades below ~600px.
      const W = 960, H = 720;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      const images = {};
      let current = 'open';

      const load = (src) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
      });

      Promise.all(Object.keys(POSES).map((k) => load(POSES[k]).then((i) => { images[k] = i; })))
        .then(() => { window.__cameraReady = true; });

      // Repaint every frame so captureStream keeps producing frames even when
      // the posture doesn't change (a static canvas can stall the track).
      const paint = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        const img = images[current];
        if (img) {
          const s = Math.min(W / img.naturalWidth, H / img.naturalHeight);
          const w = img.naturalWidth * s, h = img.naturalHeight * s;
          ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        }
        requestAnimationFrame(paint);
      };
      requestAnimationFrame(paint);

      window.__setPose = (pose) => { current = pose; };

      const stream = canvas.captureStream(30);
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => stream;
      }
    })();
  `;
}
