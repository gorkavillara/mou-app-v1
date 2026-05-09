import { type Locator, type Page, expect } from '@playwright/test';
import { BasePage } from '../base-page';

export class DoctorListPage extends BasePage {
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly newPatientButton: Locator;
  readonly statusAll: Locator;
  readonly statusActive: Locator;
  readonly statusDischarged: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'Pacientes' });
    this.searchInput = page.getByPlaceholder('Buscar por ID de paciente');
    this.newPatientButton = page.getByTestId('new-patient-btn');
    this.statusAll = page.getByRole('button', { name: 'Todos', exact: true });
    this.statusActive = page.getByRole('button', { name: 'Activos', exact: true });
    this.statusDischarged = page.getByRole('button', { name: /^Altas/i });
    this.emptyState = page.getByText(/Aún no hay pacientes|Sin resultados/i);
  }

  async goto(): Promise<void> {
    await super.goto('/doctor');
    await expect(this.heading).toBeVisible();
  }

  patientRow(externalId: string): Locator {
    return this.page.getByRole('link').filter({ hasText: externalId });
  }

  async openPatient(externalId: string): Promise<void> {
    await this.patientRow(externalId).first().click();
  }
}

export class NewPatientDialogPO {
  readonly dialog: Locator;
  readonly externalIdInput: Locator;
  readonly pathologySelect: Locator;
  readonly submitButton: Locator;
  readonly errorBox: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog');
    this.externalIdInput = page.getByLabel('ID del paciente');
    this.pathologySelect = page.getByLabel(/Patolog/i);
    this.submitButton = page.getByRole('button', { name: /Crear paciente/i });
    this.errorBox = this.dialog.locator('div.bg-red-50');
  }

  async fillAndSubmit(externalId: string, pathology?: 'flexor' | 'extensor' | 'otros'): Promise<void> {
    await this.externalIdInput.fill(externalId);
    if (pathology) await this.pathologySelect.selectOption(pathology);
    await this.submitButton.click();
  }
}
