import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

loadEnv();

const PORT = 3500;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  outputDir: './tests/.output',
  snapshotDir: './tests/.snapshots',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: './tests/.report' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
  },
  // First-hit compilation in `next dev` is slow. Give each test a generous
  // budget; production builds (`next start`) are well under this.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      dependencies: ['setup'],
    },
    {
      // We test mobile with Chromium's "iPhone 12" device descriptor (viewport,
      // user-agent, touch). Real Safari validation can come later if needed —
      // installing webkit is optional. Switch back to devices['iPhone 12'] for
      // full Safari coverage after `npx playwright install webkit`.
      name: 'mobile-iphone-12',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    // Production build: predictable timing, no compile-on-demand. The build
    // is reused across runs (Next caches in `.next`).
    command: 'npm run build && npm run start -- --port 3500',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      // Exercises the production (gated) path of /dev/calibration so the
      // @calibration spec can assert the secret-key behaviour.
      CALIBRATION_KEY: 'e2e-cal-key',
    },
  },
});
