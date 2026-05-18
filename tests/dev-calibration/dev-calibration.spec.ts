import { test, expect } from '@playwright/test';

/**
 * Gate behaviour of /dev/calibration (task G-5).
 *
 * The Playwright webServer runs with `CALIBRATION_KEY=e2e-cal-key`
 * (see playwright.config.ts → webServer.env), so this exercises the
 * deployed/gated path. We only assert the HTTP gate — never the camera
 * or MediaPipe (brittle, needs a real webcam).
 */

// No auth needed: the calibration page is not behind the doctor session.
test.use({ storageState: { cookies: [], origins: [] } });

const PATH = '/dev/calibration';

test.describe('Dev calibration gate', () => {
  test(
    'no key → 404',
    { tag: ['@calibration', '@e2e', '@CALIBRATION-E2E-001'] },
    async ({ page }) => {
      const res = await page.goto(PATH);
      expect(res?.status()).toBe(404);
    },
  );

  test(
    'correct key → page renders',
    { tag: ['@calibration', '@e2e', '@CALIBRATION-E2E-002'] },
    async ({ page }) => {
      const res = await page.goto(`${PATH}?key=e2e-cal-key`);
      expect(res?.status()).toBe(200);
      await expect(
        page.getByRole('heading', { name: 'Calibración (IA-04)' }),
      ).toBeVisible();
    },
  );

  test(
    'wrong key → 404',
    { tag: ['@calibration', '@e2e', '@CALIBRATION-E2E-003'] },
    async ({ page }) => {
      const res = await page.goto(`${PATH}?key=wrong`);
      expect(res?.status()).toBe(404);
    },
  );
});
