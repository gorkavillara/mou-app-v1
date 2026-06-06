import { expect } from '@playwright/test';
import { authedTest as test, generatePatientId } from '../helpers';
import { DoctorListPage, NewPatientDialogPO } from '../doctor-list/doctor-list-page';
import { DoctorDetailPage } from '../doctor-detail/doctor-detail-page';
import { BasePage } from '../base-page';

/**
 * BUG-1 / BUG-2 (surgeon feedback, 2026-05-20) — camera acquisition safety net.
 *
 * BUG-1: the FIRST session always went black on two different phones; the
 *   patient had to exit and re-enter for the camera to appear. The fix adds a
 *   `preparing` phase with a visible spinner, parallel model load, and a ~4s
 *   watchdog that exposes an in-place "Reintentar" button (no exit needed).
 *
 * BUG-2: the "Terminar" button fell under the notch on mobile. The session top
 *   controls now carry `pt-[max(1.5rem,env(safe-area-inset-top))]`.
 *
 * We can't reproduce an iOS user-gesture context in Chromium, so this spec
 * covers what IS deterministic:
 *   - The preparing state renders immediately (no black void).
 *   - When the camera never yields a frame (mocked never-starting stream), the
 *     watchdog surfaces the "Reintentar" button without leaving the session.
 *   - The session doesn't crash.
 *   - The "Terminar" control sits fully inside the viewport (y >= 0) at
 *     iPhone-12 dimensions (BUG-2 safe-area assertion).
 */

// Init script: stub getUserMedia to return a MediaStream from a canvas that we
// NEVER draw to, so the <video> never reaches readyState >= 2 and the watchdog
// must fire. The track is live (so play() resolves) but produces no decodable
// frame promptly.
const NEVER_STARTING_CAMERA = `
  (() => {
    const orig = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 240;
      // Intentionally never draw a frame, and use a very low fps so no frame
      // is produced within the watchdog window.
      const stream = canvas.captureStream(0);
      return stream;
    };
    void orig;
  })();
`;

async function createPatientWithPrescription(page: import('@playwright/test').Page) {
  const list = new DoctorListPage(page);
  const detail = new DoctorDetailPage(page);
  let accessUrl = '';
  let externalId = '';
  // Random nonce keeps the ID unique across the two device projects running
  // this spec concurrently (timestamp alone collides between parallel workers).
  const nonce = Math.random().toString(36).slice(2, 7);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    externalId = generatePatientId(`CAM${nonce}${attempt}`);
    await list.goto();
    const dialog = new NewPatientDialogPO(page);
    await list.newPatientButton.click();
    await dialog.fillAndSubmit(externalId, 'flexor');
    await page.waitForURL(/\/doctor\/pacientes\/[0-9a-f-]+/);
    await detail.expectLoaded(externalId);

    const txt = await page
      .locator('p.font-mono')
      .filter({ hasText: /\/p\// })
      .first()
      .textContent();
    const candidate = (txt ?? '').trim();
    const tokenSegment = candidate.split('/p/')[1] ?? '';
    if (!tokenSegment.includes('/') && !tokenSegment.includes('+')) {
      accessUrl = candidate;
      break;
    }
  }
  expect(accessUrl, 'failed to obtain a URL-safe access token').toBeTruthy();

  const patientId = page.url().match(/pacientes\/([0-9a-f-]+)/)?.[1];
  expect(patientId).toBeTruthy();

  await detail.newPrescriptionButton().click();
  const select = page.getByLabel('Ejercicio');
  await select.waitFor();
  const exerciseId = await select.locator('option').first().getAttribute('value');
  await page.keyboard.press('Escape');
  expect(exerciseId).toBeTruthy();

  const today = new Date().toISOString().slice(0, 10);
  const rxRes = await page.request.post(
    `/api/doctor/patients/${patientId}/prescriptions`,
    {
      data: {
        exercise_id: exerciseId,
        sets: 2,
        reps_per_set: 5,
        sessions_per_day: 4,
        duration_days: 7,
        starts_on: today,
      },
    },
  );
  expect(rxRes.ok(), `prescription creation failed: ${await rxRes.text()}`).toBeTruthy();

  return new URL(accessUrl).pathname; // /p/<token>
}

test.describe('Camera fallback @patient @camera', () => {
  test(
    'preparing state renders and watchdog shows in-place retry; Terminar clears the notch',
    { tag: ['@critical', '@e2e', '@patient', '@camera', '@PATIENT-CAMERA-001'] },
    async ({ page, browser }, testInfo) => {
      const tokenPath = await createPatientWithPrescription(page);

      // Anonymous patient context with a never-starting camera + camera perms.
      const anonContext = await browser.newContext({
        storageState: undefined,
        viewport: { width: 390, height: 844 },
        permissions: ['camera'],
      });
      await anonContext.addInitScript(NEVER_STARTING_CAMERA);
      const anonPage = await anonContext.newPage();
      const anon = new BasePage(anonPage);

      // Surface client errors so a crash is visible in the report.
      const pageErrors: string[] = [];
      anonPage.on('pageerror', (e) => pageErrors.push(String(e)));

      await anon.goto(tokenPath);
      await expect(anonPage.getByText(/Empezar/)).toBeVisible({ timeout: 15_000 });

      // From the patient home, tap the prescription "Empezar" → exercise intro.
      await anonPage.locator('[data-testid^="start-"]').first().click();
      await expect(anonPage.getByTestId('start-exercise')).toBeVisible();

      // Tap "Empezar" in the intro → must immediately enter the preparing state
      // (no black void): the spinner overlay is on screen.
      await anonPage.getByTestId('start-exercise').click();
      await expect(anonPage.getByTestId('start-exercise')).toHaveCount(0);
      await expect(anonPage.getByTestId('camera-preparing')).toBeVisible();
      await expect(anonPage.getByText(/Preparando cámara/i)).toBeVisible();
      // UX-3 reminder in the preparing state.
      await expect(anonPage.getByText(/DE PERFIL/i)).toBeVisible();

      await anon.snap(testInfo, 'camera-preparing');

      // BUG-2 — the Terminar control (in the HUD, laid out even while the HUD
      // is faded during preparing) must sit fully inside the viewport.
      const endBox = await anonPage.getByTestId('end-session').boundingBox();
      expect(endBox, 'end-session button should be laid out').toBeTruthy();
      expect(endBox!.y).toBeGreaterThanOrEqual(0);
      expect(endBox!.x).toBeGreaterThanOrEqual(0);
      expect(endBox!.x + endBox!.width).toBeLessThanOrEqual(390 + 0.5);

      // Watchdog (~4s) — the in-place retry button appears WITHOUT leaving the
      // session (we are still in the preparing overlay, start-exercise is gone).
      await expect(anonPage.getByTestId('camera-retry')).toBeVisible({ timeout: 8_000 });
      await expect(anonPage.getByText(/no arranca/i)).toBeVisible();
      await anon.snap(testInfo, 'camera-stalled-retry');

      // Tapping retry re-runs acquisition in place: the spinner returns and the
      // session does not crash / does not bounce back to intro.
      await anonPage.getByTestId('camera-retry').click();
      await expect(anonPage.getByTestId('camera-preparing')).toBeVisible();
      await expect(anonPage.getByTestId('start-exercise')).toHaveCount(0);

      expect(pageErrors, `client errors: ${pageErrors.join('\n')}`).toEqual([]);

      await anonContext.close();
    },
  );
});
