import { expect } from '@playwright/test';
import { authedTest as test, generatePatientId } from '../helpers';
import { DoctorListPage, NewPatientDialogPO } from '../doctor-list/doctor-list-page';
import { DoctorDetailPage } from '../doctor-detail/doctor-detail-page';
import { BasePage } from '../base-page';
import { fakeHandCameraScript } from './fake-camera';

/**
 * PATIENT-MEASURE-001 — the measurement pipeline, end to end, with real hands.
 *
 * Everything else in the suite stops at the exercise intro. This one runs the
 * part the product is actually judged on: MediaPipe detects a hand, the joint
 * angles are computed and normalized through `JOINT_CALIBRATION`, the rep
 * counter's hysteresis fires, the session reaches `done` and POSTs its
 * measurements, and the doctor side can read them back.
 *
 * The camera is fed the surgeon's goniometer photos (see `fake-camera.ts`), so
 * the angles crossing the thresholds are real readings off a real hand — not
 * synthetic landmarks. That also makes this the only regression guard on the
 * IA-18 chirality fix in a running session: with the sign inverted, a fist
 * normalizes to `clinicalMin` (−30°) instead of ~90°, never crosses the
 * flexion threshold, and this test times out with 0 repetitions.
 */

const SETS = 1;
const REPS_PER_SET = 2;

test.describe('Measurement session @patient @camera @measure', () => {
  test(
    'detects a real hand, counts repetitions and saves the session',
    { tag: ['@critical', '@e2e', '@patient', '@PATIENT-MEASURE-001'] },
    async ({ page, browser }, testInfo) => {
      // Runs once, not once per device project. The spec drives its own
      // 390x844 context anyway, so the project would only decide which worker
      // pays for a full MediaPipe session on CPU — the most expensive test we
      // have. (Declared here, not as a describe-level modifier: that callback
      // only receives fixtures, never testInfo.)
      test.skip(
        testInfo.project.name !== 'chromium-desktop',
        'cubierto una vez en chromium-desktop; el spec fija su propio viewport móvil',
      );
      // MediaPipe on CPU plus a full session needs more room than the default.
      test.setTimeout(180_000);

      // --- doctor side: patient with an injured index (the finger the photos
      // show) and a short prescription so the session ends quickly ---
      const list = new DoctorListPage(page);
      const detail = new DoctorDetailPage(page);
      const externalId = generatePatientId(
        `MEAS${Math.random().toString(36).slice(2, 6)}`,
      );

      await list.goto();
      await list.newPatientButton.click();
      await new NewPatientDialogPO(page).fillAndSubmit(externalId, 'flexor', {
        injured: ['indice'],
      });
      await page.waitForURL(/\/doctor\/pacientes\/[0-9a-f-]+/);
      await detail.expectLoaded(externalId);

      const patientId = page.url().match(/pacientes\/([0-9a-f-]+)/)?.[1];
      expect(patientId).toBeTruthy();

      const accessUrl = (
        await page.locator('p.font-mono').filter({ hasText: /\/p\// }).first().textContent()
      )?.trim();
      expect(accessUrl, 'access URL should be on the detail page').toBeTruthy();

      await detail.newPrescriptionButton().click();
      const select = page.getByLabel('Ejercicio');
      await select.waitFor();
      const exerciseId = await select.locator('option').first().getAttribute('value');
      await page.keyboard.press('Escape');

      const rxRes = await page.request.post(
        `/api/doctor/patients/${patientId}/prescriptions`,
        {
          data: {
            exercise_id: exerciseId,
            sets: SETS,
            reps_per_set: REPS_PER_SET,
            sessions_per_day: 4,
            duration_days: 7,
            starts_on: new Date().toISOString().slice(0, 10),
          },
        },
      );
      expect(rxRes.ok(), `prescription creation failed: ${await rxRes.text()}`).toBeTruthy();

      // --- patient side: anonymous context with the hand-photo camera ---
      const anonContext = await browser.newContext({
        storageState: undefined,
        viewport: { width: 390, height: 844 },
        permissions: ['camera'],
      });
      await anonContext.addInitScript(fakeHandCameraScript());
      const anonPage = await anonContext.newPage();
      const anon = new BasePage(anonPage);

      const pageErrors: string[] = [];
      anonPage.on('pageerror', (e) => pageErrors.push(String(e)));

      await anon.goto(new URL(accessUrl!).pathname);
      await anonPage.locator('[data-testid^="start-"]').first().click();
      await anonPage.getByTestId('start-exercise').click();

      // The HUD only mounts once the camera yields frames and the session is
      // running — this is already proof the stream was accepted.
      await expect(anonPage.getByTestId('rep-counter')).toBeVisible({ timeout: 60_000 });

      const repCounter = anonPage.getByTestId('rep-counter');
      const liveAngle = anonPage.getByTestId('live-angle-value');
      const setPose = (pose: 'open' | 'fist') =>
        anonPage.evaluate((p) => {
          (window as unknown as { __setPose: (p: string) => void }).__setPose(p);
        }, pose);
      /** The HUD renders a typographic minus, so normalize before parsing. */
      const readAngle = async () => {
        const text = (await liveAngle.textContent()) ?? '';
        return Number(text.replace(/−/g, '-').match(/-?\d+/)?.[0] ?? 'NaN');
      };

      // The extended pose must read near 0°: this is the goniometer's 0°, and
      // it is what tells us the hand is actually being measured.
      await expect
        .poll(readAngle, {
          timeout: 45_000,
          message: 'the extended hand never produced a reading near 0°',
        })
        .toBeLessThanOrEqual(15);

      await anon.snap(testInfo, 'measure-running');

      // IA-18 regression guard. A closed fist is ~90° of real MCP flexion. With
      // the chirality sign inverted the same posture normalizes to the −30°
      // extension floor, so this assertion — not the rep count — is what
      // actually pins the fix.
      await setPose('fist');
      await expect
        .poll(readAngle, {
          timeout: 30_000,
          message: 'a closed fist never registered as flexion (chirality regression?)',
        })
        .toBeGreaterThan(60);
      await setPose('open');

      const targetReps = SETS * REPS_PER_SET;
      for (let cycle = 0; cycle < targetReps * 4; cycle += 1) {
        const counted = Number((await repCounter.textContent().catch(() => '0')) ?? '0');
        if (counted >= targetReps) break;
        await setPose('fist');
        await anonPage.waitForTimeout(900);
        await setPose('open');
        await anonPage.waitForTimeout(900);
      }

      // --- the session must close itself and persist ---
      await expect(anonPage.getByText('Sesión terminada')).toBeVisible({ timeout: 60_000 });
      await expect(anonPage.getByTestId('summary-finger').first()).toBeVisible();
      await expect(
        anonPage.getByTestId('summary-finger').filter({ hasText: 'Índice' }),
      ).toBeVisible();
      await expect(anonPage.getByTestId('submit-state')).toContainText('Datos guardados', {
        timeout: 30_000,
      });

      await anon.snap(testInfo, 'measure-done');
      expect(pageErrors, `client errors: ${pageErrors.join('\n')}`).toEqual([]);

      // --- and the doctor must be able to read it back ---
      const detailRes = await page.request.get(`/api/doctor/patients/${patientId}`);
      expect(detailRes.ok()).toBeTruthy();
      const body = (await detailRes.json()) as { sessions?: Array<{ reps_completed?: number }> };
      expect(body.sessions?.length, 'the session should reach the doctor side').toBeGreaterThan(0);

      await anonContext.close();
    },
  );
});
