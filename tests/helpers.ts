import { test as base } from '@playwright/test';

export const E2E_EMAIL = process.env.MOU_E2E_EMAIL ?? 'e2e@mou.local';
export const E2E_PASSWORD = process.env.MOU_E2E_PASSWORD ?? 'mou-e2e-CHANGE-ME!';

export const STORAGE_STATE = 'tests/.auth/doctor.json';

/**
 * Generate a unique anonymous patient identifier for tests.
 * The Mou data model is anonymous — no PII allowed in any field.
 */
export function generatePatientId(prefix = 'E2E'): string {
  const ts = Date.now().toString(36);
  return `${prefix}-${ts}`;
}

/**
 * `test` wrapper that loads the saved doctor session before each test.
 * Use it for any spec that needs to be authenticated as Dr. Javi.
 */
export const authedTest = base.extend({
  storageState: STORAGE_STATE,
});
