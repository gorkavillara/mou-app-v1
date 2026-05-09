/**
 * Authenticated Playwright projects depend on this setup.
 * It logs the E2E doctor in via the real /login form and saves the
 * Supabase cookies to STORAGE_STATE for the rest of the suite.
 *
 * Pre-req: run `npm run e2e:bootstrap` once to ensure the doctor exists in
 * Supabase Auth + public.doctors. CI runs that automatically.
 */

import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { E2E_EMAIL, E2E_PASSWORD, STORAGE_STATE } from './helpers';

setup('authenticate as Dr. E2E', async ({ page, request }) => {
  // Warm up Next.js dev server: hit the routes the auth flow will compile so
  // the actual sign-in click doesn't time out on first compile.
  await request.get('/login');
  await request.get('/api/auth/me').catch(() => {});
  await request.get('/doctor').catch(() => {});

  mkdirSync(dirname(STORAGE_STATE), { recursive: true });

  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(E2E_EMAIL);
  await page.getByLabel('Contraseña').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: /Iniciar sesión/i }).click();

  await page.waitForURL(/\/doctor(\/.*)?$/, { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
