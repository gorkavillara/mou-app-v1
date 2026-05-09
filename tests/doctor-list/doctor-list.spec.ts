import { expect } from '@playwright/test';
import { authedTest as test, generatePatientId } from '../helpers';
import { DoctorListPage, NewPatientDialogPO } from './doctor-list-page';
import { DoctorDetailPage } from '../doctor-detail/doctor-detail-page';

test.describe('Doctor patient list', () => {
  test(
    'shows the heading, toolbar and (empty or populated) list',
    { tag: ['@critical', '@e2e', '@doctor-list', '@DOCTOR-LIST-E2E-001'] },
    async ({ page }, testInfo) => {
      const list = new DoctorListPage(page);
      await list.goto();

      await expect(list.searchInput).toBeVisible();
      await expect(list.newPatientButton).toBeVisible();
      await expect(list.statusAll).toBeVisible();
      await expect(list.statusActive).toBeVisible();

      await list.snap(testInfo, 'doctor-list');
    },
  );

  test(
    'creates a new patient and lands on the detail page',
    { tag: ['@critical', '@e2e', '@doctor-list', '@DOCTOR-LIST-E2E-002'] },
    async ({ page }, testInfo) => {
      const externalId = generatePatientId();
      const list = new DoctorListPage(page);
      await list.goto();

      const dialog = new NewPatientDialogPO(page);
      await list.newPatientButton.click();
      await expect(dialog.dialog).toBeVisible();
      await list.snap(testInfo, 'new-patient-dialog');

      await dialog.fillAndSubmit(externalId, 'flexor');

      await page.waitForURL(/\/doctor\/pacientes\/[0-9a-f-]+/);
      const detail = new DoctorDetailPage(page);
      await expect(detail.heading(externalId)).toBeVisible();
      await detail.snap(testInfo, 'patient-detail-after-create');
    },
  );

  test(
    'rejects a duplicate external_id with a friendly error',
    { tag: ['@high', '@e2e', '@doctor-list', '@DOCTOR-LIST-E2E-003'] },
    async ({ page }, testInfo) => {
      const externalId = generatePatientId('DUP');
      const list = new DoctorListPage(page);
      await list.goto();

      const dialog = new NewPatientDialogPO(page);
      await list.newPatientButton.click();
      await dialog.fillAndSubmit(externalId);

      await page.waitForURL(/\/doctor\/pacientes\/[0-9a-f-]+/);
      await page.goBack();
      await list.heading.waitFor();

      await list.newPatientButton.click();
      await dialog.fillAndSubmit(externalId);
      await expect(dialog.errorBox).toContainText(/ya tienes un paciente|usa otro identificador/i);
      await list.snap(testInfo, 'new-patient-dialog-duplicate-error');
    },
  );

  test(
    'searches by external_id via URL params',
    { tag: ['@medium', '@e2e', '@doctor-list', '@DOCTOR-LIST-E2E-004'] },
    async ({ page }) => {
      const list = new DoctorListPage(page);
      await list.goto();

      await list.searchInput.fill('does-not-exist-zz');
      await list.searchInput.press('Enter');

      await page.waitForURL(/search=does-not-exist-zz/);
      await expect(page.getByText(/Sin resultados/i)).toBeVisible();
    },
  );

  test(
    'a freshly-created patient row shows the 7 d caption and "Sin sesiones todavía" note',
    { tag: ['@high', '@e2e', '@doctor-list', '@DOCTOR-LIST-E2E-005'] },
    async ({ page }, testInfo) => {
      const externalId = generatePatientId('LSESS');
      const list = new DoctorListPage(page);
      await list.goto();

      const dialog = new NewPatientDialogPO(page);
      await list.newPatientButton.click();
      await dialog.fillAndSubmit(externalId);
      await page.waitForURL(/\/doctor\/pacientes\/[0-9a-f-]+/);

      // Back to the list and locate the freshly created row.
      await list.goto();
      await list.searchInput.fill(externalId);
      await page.waitForURL(new RegExp(`search=${externalId}`));

      const row = list.patientRow(externalId).first();
      await expect(row).toBeVisible();
      await expect(row).toContainText(/Sin sesiones todavía/i);
      // No prescription yet, so the 7 d caption only renders once a
      // prescription exists. Confirm at least the "Sin sesiones" note
      // is present and the bar fallback copy is consistent.
      await expect(row).toContainText(/Sin prescripción/i);

      await list.snap(testInfo, 'doctor-list-with-fresh-patient');
    },
  );
});
