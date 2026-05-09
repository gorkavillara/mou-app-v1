import { expect } from '@playwright/test';
import { authedTest as test, generatePatientId } from '../helpers';
import { DoctorListPage, NewPatientDialogPO } from '../doctor-list/doctor-list-page';
import {
  DoctorDetailPage,
  NewPrescriptionDialogPO,
  DischargeDialogPO,
} from './doctor-detail-page';

async function createPatient(page: import('@playwright/test').Page, externalId: string): Promise<void> {
  const list = new DoctorListPage(page);
  await list.goto();
  await list.newPatientButton.click();
  const dialog = new NewPatientDialogPO(page);
  await dialog.fillAndSubmit(externalId);
  await page.waitForURL(/\/doctor\/pacientes\/[0-9a-f-]+/);
}

test.describe('Doctor patient detail', () => {
  test(
    'detail page shows header, access QR section and prescriptions block',
    { tag: ['@critical', '@e2e', '@doctor-detail', '@DOCTOR-DETAIL-E2E-001'] },
    async ({ page }, testInfo) => {
      const externalId = generatePatientId('VIEW');
      await createPatient(page, externalId);

      const detail = new DoctorDetailPage(page);
      await detail.expectLoaded(externalId);
      await expect(detail.statusBadge()).toContainText('Activo');
      await expect(detail.dischargeButton()).toBeVisible();
      await detail.snap(testInfo, 'patient-detail-fresh');
    },
  );

  test(
    'add a new prescription with live total reps preview',
    { tag: ['@critical', '@e2e', '@doctor-detail', '@DOCTOR-DETAIL-E2E-002'] },
    async ({ page }, testInfo) => {
      const externalId = generatePatientId('RX');
      await createPatient(page, externalId);

      const detail = new DoctorDetailPage(page);
      await detail.newPrescriptionButton().click();

      const rxDialog = new NewPrescriptionDialogPO(page);
      await expect(rxDialog.dialog).toBeVisible();
      await rxDialog.setsInput.fill('3');
      await rxDialog.repsInput.fill('20');
      await rxDialog.sessionsPerDayInput.fill('4');
      await rxDialog.durationDaysInput.fill('14');
      await expect(rxDialog.preview).toContainText('3');
      await expect(rxDialog.preview).toContainText('20');
      await expect(rxDialog.preview).toContainText('4');
      await expect(rxDialog.preview).toContainText(/3\.?360/); // 3 × 20 × 4 × 14

      await detail.snap(testInfo, 'new-prescription-dialog');

      await rxDialog.submitButton.click();
      await rxDialog.dialog.waitFor({ state: 'detached' });
      await expect(detail.prescriptionsSection()).toContainText(/Flexión|Extensión|series|reps/i);
      await detail.snap(testInfo, 'patient-detail-with-prescription');
    },
  );

  test(
    'discharge a patient hides the discharge button and toggles status',
    { tag: ['@high', '@e2e', '@doctor-detail', '@DOCTOR-DETAIL-E2E-003'] },
    async ({ page }, testInfo) => {
      const externalId = generatePatientId('END');
      await createPatient(page, externalId);

      const dlg = new DischargeDialogPO(page);
      await dlg.trigger.click();
      await expect(dlg.dialog).toBeVisible();
      await dlg.confirm.click();

      const detail = new DoctorDetailPage(page);
      await expect(detail.statusBadge()).toContainText('Dado de alta');
      await expect(detail.dischargeButton()).toHaveCount(0);
      await detail.snap(testInfo, 'patient-detail-discharged');
    },
  );
});
