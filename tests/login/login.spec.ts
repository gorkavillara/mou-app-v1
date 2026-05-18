import { test, expect } from '@playwright/test';
import { LoginPage } from './login-page';

// These specs run without authentication, on the unauthenticated /login page.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login', () => {
  test(
    'home redirects to /login when there is no session',
    { tag: ['@critical', '@e2e', '@login', '@LOGIN-E2E-001'] },
    async ({ page }, testInfo) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('heading', { name: 'Mou' })).toBeVisible();

      const lp = new LoginPage(page);
      await lp.snap(testInfo, 'login-empty');
    },
  );

  test(
    'shows an error on invalid credentials',
    { tag: ['@high', '@e2e', '@login', '@LOGIN-E2E-002'] },
    async ({ page }, testInfo) => {
      const lp = new LoginPage(page);
      await lp.goto();
      await lp.login({ email: 'nope@mou.local', password: 'wrong-password' });
      await lp.expectError(/Credenciales incorrectas/i);
      await lp.snap(testInfo, 'login-invalid-credentials');
    },
  );

  test(
    'submit button is disabled until both fields are filled',
    { tag: ['@medium', '@e2e', '@login', '@LOGIN-E2E-003'] },
    async ({ page }) => {
      const lp = new LoginPage(page);
      await lp.goto();
      await expect(lp.submitButton).toBeDisabled();

      await lp.emailInput.fill('javi@mou.local');
      await expect(lp.submitButton).toBeDisabled();

      await lp.passwordInput.fill('whatever');
      await expect(lp.submitButton).toBeEnabled();
    },
  );

  test(
    'protected /doctor route bounces unauthenticated users to login with next param',
    { tag: ['@critical', '@e2e', '@login', '@LOGIN-E2E-004'] },
    async ({ page }) => {
      await page.goto('/doctor');
      await expect(page).toHaveURL(/\/login\?next=%2Fdoctor/);
    },
  );
});
