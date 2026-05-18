import { expect } from '@playwright/test';
import { authedTest as test, generatePatientId } from '../helpers';
import { DoctorListPage, NewPatientDialogPO } from '../doctor-list/doctor-list-page';
import { DoctorDetailPage } from './doctor-detail-page';

async function createPatient(
  page: import('@playwright/test').Page,
  externalId: string,
): Promise<void> {
  const list = new DoctorListPage(page);
  await list.goto();
  await list.newPatientButton.click();
  const dialog = new NewPatientDialogPO(page);
  await dialog.fillAndSubmit(externalId);
  await page.waitForURL(/\/doctor\/pacientes\/[0-9a-f-]+/);
}

test.describe('Doctor patient detail · progression', () => {
  test(
    'progression section shows the empty-state copy for a fresh patient',
    { tag: ['@high', '@e2e', '@doctor-detail', '@DOCTOR-DETAIL-E2E-004'] },
    async ({ page }, testInfo) => {
      const externalId = generatePatientId('PROG');
      await createPatient(page, externalId);

      const detail = new DoctorDetailPage(page);
      await detail.expectLoaded(externalId);

      // The "Progresión angular" section should exist with the empty copy.
      await expect(
        page.getByRole('heading', { level: 2, name: /Progresión angular/i }),
      ).toBeVisible();
      await expect(
        page.getByText(/Aún no hay datos de movimiento/i),
      ).toBeVisible();

      await detail.snap(testInfo, 'patient-detail-progression-empty');
    },
  );
});
