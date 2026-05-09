import { type Page, expect } from '@playwright/test';
import { authedTest as test, generatePatientId } from '../helpers';
import { DoctorListPage, NewPatientDialogPO } from '../doctor-list/doctor-list-page';
import { DoctorDetailPage } from './doctor-detail-page';

/**
 * F-14 — Print-friendly QR sheet.
 *
 * We don't trigger `window.print()` (Playwright can't dismiss the native
 * dialog cleanly). Instead `emulateMedia({ media: 'print' })` switches the
 * CSS engine into print mode without opening anything, and we assert that:
 *
 *   1. The printable QR sheet is visible.
 *   2. Everything else on the page (DoctorShell header, AccessSection,
 *      Prescripciones, Sesiones recientes) is hidden.
 *
 * Screenshots are captured in both projects so we have visual evidence the
 * sheet renders cleanly on desktop and mobile viewports alike.
 */

async function createPatient(page: Page, externalId: string): Promise<void> {
  const list = new DoctorListPage(page);
  await list.goto();
  await list.newPatientButton.click();
  const dialog = new NewPatientDialogPO(page);
  await dialog.fillAndSubmit(externalId);
  await page.waitForURL(/\/doctor\/pacientes\/[0-9a-f-]+/);
}

test.describe('Doctor patient print sheet @print', () => {
  test(
    'print media renders QR sheet only and hides the rest of the page',
    { tag: ['@high', '@e2e', '@print', '@DOCTOR-PRINT-E2E-001'] },
    async ({ page }, testInfo) => {
      const externalId = generatePatientId('PRINT');
      await createPatient(page, externalId);

      const detail = new DoctorDetailPage(page);
      await detail.expectLoaded(externalId);

      // Switch the CSS engine into print mode. This applies any `@media
      // print` rules — including Tailwind's `print:` modifiers — without
      // opening the browser's print dialog.
      await page.emulateMedia({ media: 'print' });

      const sheet = page.getByTestId('printable-qr-sheet');
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText('Escanea para empezar tu rehabilitación');
      await expect(sheet).toContainText(externalId);
      await expect(sheet).toContainText('Mou — rehabilitación de mano');

      // The rest of the page must be hidden in print. We use Playwright's
      // visibility check, which honours `display: none` (the effect of
      // `print:hidden`). The PO's broad `Sesiones`/`Prescripciones` filters
      // can match more than one element on this page, so we assert on
      // single, unambiguous handles instead.
      await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeHidden();
      await expect(detail.heading(externalId)).toBeHidden();
      await expect(page.getByRole('heading', { name: 'Acceso del paciente' })).toBeHidden();
      await expect(page.getByRole('heading', { name: 'Prescripciones activas' })).toBeHidden();
      await expect(page.getByRole('heading', { name: 'Sesiones recientes' })).toBeHidden();

      await detail.snap(testInfo, 'patient-print-sheet');

      // Restore screen mode so other assertions / cleanup behave normally.
      await page.emulateMedia({ media: 'screen' });
    },
  );
});
