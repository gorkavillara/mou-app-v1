import { type Locator, type Page, expect } from '@playwright/test';
import { BasePage } from '../base-page';

export class DoctorDetailPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  heading(externalId: string): Locator {
    return this.page.getByRole('heading', { name: externalId, level: 1 });
  }

  /** "Activo" or "Dado de alta" badge in the header. */
  statusBadge(): Locator {
    return this.page.locator('header span').filter({ hasText: /Activo|Dado de alta/ });
  }

  accessSection(): Locator {
    return this.page.locator('section').filter({ hasText: 'Acceso del paciente' });
  }

  prescriptionsSection(): Locator {
    return this.page.locator('section').filter({ hasText: /Prescripciones/i });
  }

  recentSessionsSection(): Locator {
    return this.page.locator('section').filter({ hasText: /Sesiones/i });
  }

  newPrescriptionButton(): Locator {
    return this.page.getByRole('button', { name: /Añadir|Nueva prescripción/i });
  }

  dischargeButton(): Locator {
    return this.page.getByRole('button', { name: 'Finalizar rehabilitación' });
  }

  async expectLoaded(externalId: string): Promise<void> {
    await expect(this.heading(externalId)).toBeVisible();
    await expect(this.accessSection()).toBeVisible();
  }
}

export class NewPrescriptionDialogPO {
  readonly dialog: Locator;
  readonly exerciseSelect: Locator;
  readonly setsInput: Locator;
  readonly repsInput: Locator;
  readonly sessionsPerDayInput: Locator;
  readonly durationDaysInput: Locator;
  readonly openEndedPill: Locator;
  readonly withEndDatePill: Locator;
  readonly preview: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog').filter({ hasText: 'Nueva prescripción' });
    this.exerciseSelect = this.dialog.getByLabel('Ejercicio');
    this.setsInput = this.dialog.getByLabel('Series');
    this.repsInput = this.dialog.getByLabel('Reps por serie');
    this.sessionsPerDayInput = this.dialog.getByLabel('Sesiones/día');
    this.durationDaysInput = this.dialog.getByLabel('Duración (días)');
    this.openEndedPill = this.dialog.getByRole('radio', { name: 'Sin fecha de fin' });
    this.withEndDatePill = this.dialog.getByRole('radio', { name: 'Hasta una fecha' });
    this.preview = this.dialog.locator('div.bg-blue-50');
    this.submitButton = this.dialog.getByRole('button', { name: /Añadir/ });
  }

  /**
   * Fill and submit. Pass `durationDays` to switch to the
   * "Hasta una fecha" mode; omit to keep the default open-ended mode.
   */
  async fillAndSubmit(opts: {
    sets?: number; reps?: number; sessionsPerDay?: number; durationDays?: number;
  } = {}): Promise<void> {
    if (opts.sets !== undefined) await this.setsInput.fill(String(opts.sets));
    if (opts.reps !== undefined) await this.repsInput.fill(String(opts.reps));
    if (opts.sessionsPerDay !== undefined)
      await this.sessionsPerDayInput.fill(String(opts.sessionsPerDay));
    if (opts.durationDays !== undefined) {
      await this.withEndDatePill.click();
      await this.durationDaysInput.fill(String(opts.durationDays));
    }
    await this.submitButton.click();
  }
}

export class DischargeDialogPO {
  readonly trigger: Locator;
  readonly dialog: Locator;
  readonly confirm: Locator;

  constructor(page: Page) {
    this.trigger = page.getByRole('button', { name: 'Finalizar rehabilitación' });
    this.dialog = page.getByRole('dialog').filter({ hasText: 'Finalizar rehabilitación' });
    this.confirm = this.dialog.getByRole('button', { name: 'Sí, finalizar' });
  }
}
