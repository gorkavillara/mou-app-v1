import { expect } from '@playwright/test';
import { authedTest as test, generatePatientId } from '../helpers';
import { DoctorListPage, NewPatientDialogPO } from '../doctor-list/doctor-list-page';
import { DoctorDetailPage } from '../doctor-detail/doctor-detail-page';
import { BasePage } from '../base-page';

/**
 * F-08/F-09/F-10 — Patient flow e2e.
 *
 * Strategy:
 *   1. Authed context creates a patient (UI) and a prescription (API).
 *   2. We grab the public URL from the detail page.
 *   3. A fresh anonymous context opens that URL → asserts the home renders,
 *      taps "Empezar" on the prescription → asserts the intro phase renders.
 *
 * The actual MediaPipe / camera flow is NOT exercised — mocking the model is
 * brittle and gives little value. We assert the intro UI only.
 */

test.describe('Patient flow @patient', () => {
  test(
    'shows the patient home and the exercise intro phase',
    { tag: ['@critical', '@e2e', '@patient', '@PATIENT-E2E-001'] },
    async ({ page, browser }, testInfo) => {
      // 1. Create patients until we get one whose access_token has no `/` or `+`
      // characters. The backend currently emits raw base64; those characters
      // break Next.js dynamic segments. We retry up to 6 times (~99% chance of
      // a clean token across attempts). When the backend switches to base64url
      // this loop becomes a no-op.
      let externalId = '';
      const detail = new DoctorDetailPage(page);
      const list = new DoctorListPage(page);
      let accessUrl = '';
      for (let attempt = 0; attempt < 6; attempt += 1) {
        externalId = generatePatientId(`PAT${attempt}`);
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

      // 2. Find an exercise from the catalog and create a prescription via API.
      const patientUrlMatch = page.url().match(/pacientes\/([0-9a-f-]+)/);
      const patientId = patientUrlMatch?.[1];
      expect(patientId).toBeTruthy();

      // Open the new-prescription dialog just to scrape the first exercise ID
      // from the <select> options; then close it and create the prescription
      // via the API for stability.
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

      // 3. Compute the path from the URL we already captured.
      const tokenPath = new URL(accessUrl).pathname; // /p/<token>

      // 4. Anonymous context — visit the patient URL.
      const anonContext = await browser.newContext({ storageState: undefined });
      const anonPage = await anonContext.newPage();
      const anon = new BasePage(anonPage);
      await anon.goto(tokenPath);

      await expect(
        anonPage.getByText(externalId, { exact: false }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(anonPage.getByTestId('prescriptions-list')).toBeVisible();
      await expect(anonPage.getByText(/Empezar/)).toBeVisible();

      await anon.snap(testInfo, 'patient-home');

      // 5. Tap the first "Empezar" → intro of the exercise.
      const startBtn = anonPage.locator('[data-testid^="start-"]').first();
      await startBtn.click();

      await expect(anonPage.getByTestId('start-exercise')).toBeVisible();
      await expect(
        anonPage.getByText(/repeticiones de/i).first(),
      ).toBeVisible();

      await anon.snap(testInfo, 'patient-exercise-intro');

      await anonContext.close();
    },
  );
});

