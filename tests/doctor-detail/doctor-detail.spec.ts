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
    'add a new prescription with explicit end date and live total reps preview',
    { tag: ['@critical', '@e2e', '@doctor-detail', '@DOCTOR-DETAIL-E2E-002'] },
    async ({ page }, testInfo) => {
      const externalId = generatePatientId('RX');
      await createPatient(page, externalId);

      const detail = new DoctorDetailPage(page);
      await detail.newPrescriptionButton().click();

      const rxDialog = new NewPrescriptionDialogPO(page);
      await expect(rxDialog.dialog).toBeVisible();

      // FIX-1: centered dialog (Tailwind 4 preflight wipes `margin: auto`).
      const viewport = page.viewportSize();
      if (viewport) {
        const box = await rxDialog.dialog.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          const offset = Math.abs(box.x + box.width / 2 - viewport.width / 2);
          expect(offset).toBeLessThan(24);
        }
      }

      // Default is "Sin fecha de fin" — toggle to a fixed-duration treatment.
      await expect(rxDialog.openEndedPill).toHaveAttribute('aria-checked', 'true');
      await rxDialog.withEndDatePill.click();
      await expect(rxDialog.withEndDatePill).toHaveAttribute('aria-checked', 'true');

      await rxDialog.setsInput.fill('3');
      await rxDialog.repsInput.fill('20');
      await rxDialog.sessionsPerDayInput.fill('4');
      await rxDialog.durationDaysInput.fill('14');
      await expect(rxDialog.preview).toContainText('3');
      await expect(rxDialog.preview).toContainText('20');
      await expect(rxDialog.preview).toContainText('4');
      await expect(rxDialog.preview).toContainText(/durante/);
      await expect(rxDialog.preview).toContainText(/3\.?360/); // 3 × 20 × 4 × 14

      await detail.snap(testInfo, 'new-prescription-dialog');

      await rxDialog.submitButton.click();
      await rxDialog.dialog.waitFor({ state: 'detached' });
      await expect(detail.prescriptionsSection()).toContainText(/Flexión|Extensión|series|reps/i);
      await detail.snap(testInfo, 'patient-detail-with-prescription');
    },
  );

  test(
    'add an open-ended prescription (no duration) — default flow',
    { tag: ['@critical', '@e2e', '@doctor-detail', '@DOCTOR-DETAIL-E2E-004'] },
    async ({ page }, testInfo) => {
      const externalId = generatePatientId('RXOPEN');
      await createPatient(page, externalId);

      const detail = new DoctorDetailPage(page);
      await detail.newPrescriptionButton().click();

      const rxDialog = new NewPrescriptionDialogPO(page);
      await expect(rxDialog.dialog).toBeVisible();

      // Default mode is open-ended and the duration field is hidden.
      await expect(rxDialog.openEndedPill).toHaveAttribute('aria-checked', 'true');
      await expect(rxDialog.durationDaysInput).toHaveCount(0);

      await rxDialog.setsInput.fill('3');
      await rxDialog.repsInput.fill('20');
      await rxDialog.sessionsPerDayInput.fill('4');

      // Live preview never mentions "durante X días" while in open-ended mode.
      await expect(rxDialog.preview).toContainText(/sin fecha de fin/i);
      await expect(rxDialog.preview).not.toContainText(/durante/i);

      await detail.snap(testInfo, 'new-prescription-dialog-open-ended');

      await rxDialog.submitButton.click();
      await rxDialog.dialog.waitFor({ state: 'detached' });
      await expect(detail.prescriptionsSection()).toContainText(/Flexión|Extensión|series|reps/i);
      await detail.snap(testInfo, 'patient-detail-with-open-ended-prescription');
    },
  );

  test(
    'create with multiple finger statuses shows the summary and can be edited inline',
    { tag: ['@high', '@e2e', '@doctor-detail', '@DOCTOR-DETAIL-E2E-005'] },
    async ({ page }, testInfo) => {
      const externalId = generatePatientId('FINGER');
      const list = new DoctorListPage(page);
      await list.goto();
      await list.newPatientButton.click();
      const dialog = new NewPatientDialogPO(page);
      // FB-1: mark Meñique = Lesionado and Índice = Amputado in the dialog.
      await dialog.fillAndSubmit(externalId, undefined, {
        injured: ['menique'],
        amputated: ['indice'],
      });
      await page.waitForURL(/\/doctor\/pacientes\/[0-9a-f-]+/);

      const detail = new DoctorDetailPage(page);
      await detail.expectLoaded(externalId);

      // Summary shows both groups (chosen at creation).
      await expect(detail.fingerStatusSummary()).toContainText('Lesionado: Meñique');
      await expect(detail.fingerStatusSummary()).toContainText('Amputado: Índice');
      await detail.snap(testInfo, 'patient-detail-injured-finger');

      // Edit: add Anular = Lesionado, then save (PATCH full replacement).
      await detail.fingerStatusEditButton().click();
      await detail.setFingerState('anular', 'injured');
      await detail.fingerStatusSaveButton().click();
      await expect(detail.fingerStatusSummary()).toContainText('Meñique');
      await expect(detail.fingerStatusSummary()).toContainText('Anular');

      // Persists across a reload.
      await page.reload();
      await expect(detail.fingerStatusSummary()).toContainText('Lesionados: Meñique, Anular');
      await expect(detail.fingerStatusSummary()).toContainText('Amputado: Índice');
    },
  );

  test(
    'create with surgery date + note shows the IQ line and can be edited inline',
    { tag: ['@high', '@e2e', '@doctor-detail', '@DOCTOR-DETAIL-E2E-006'] },
    async ({ page }, testInfo) => {
      const externalId = generatePatientId('SURGERY');
      const list = new DoctorListPage(page);
      await list.goto();
      await list.newPatientButton.click();
      const dialog = new NewPatientDialogPO(page);
      await dialog.fillAndSubmit(externalId, undefined, undefined, {
        date: '2026-05-19',
        note: 'Tenorrafia FDP 5º dedo',
      });
      await page.waitForURL(/\/doctor\/pacientes\/[0-9a-f-]+/);

      const detail = new DoctorDetailPage(page);
      await detail.expectLoaded(externalId);

      // Surgeon's exact target format: "IQ 19/5/26 · Tenorrafia FDP 5º dedo".
      await expect(detail.surgeryLine()).toHaveText('IQ 19/5/26 · Tenorrafia FDP 5º dedo');
      await detail.snap(testInfo, 'patient-detail-surgery');

      // Edit the note inline → PATCH → persists across a reload.
      await detail.surgeryEditButton().click();
      await detail.surgeryNoteInput().fill('Tenorrafia FDP 4º dedo');
      await detail.surgerySaveButton().click();
      await expect(detail.surgeryLine()).toHaveText('IQ 19/5/26 · Tenorrafia FDP 4º dedo');

      await page.reload();
      await expect(detail.surgeryLine()).toHaveText('IQ 19/5/26 · Tenorrafia FDP 4º dedo');

      // Clear the note → line drops to just the IQ date.
      await detail.surgeryEditButton().click();
      await detail.surgeryNoteInput().fill('');
      await detail.surgerySaveButton().click();
      await expect(detail.surgeryLine()).toHaveText('IQ 19/5/26');

      await page.reload();
      await expect(detail.surgeryLine()).toHaveText('IQ 19/5/26');
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
