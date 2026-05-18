import { type Locator, type Page, expect } from '@playwright/test';
import { BasePage } from '../base-page';

export type LoginCredentials = { email: string; password: string };

export class LoginPage extends BasePage {
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorBox: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'Mou' });
    this.emailInput = page.getByLabel('Correo electrónico');
    this.passwordInput = page.getByLabel('Contraseña');
    this.submitButton = page.getByRole('button', { name: /Iniciar sesión/i });
    this.errorBox = page.locator('div.bg-red-50');
  }

  async goto(): Promise<void> {
    await super.goto('/login');
    await expect(this.heading).toBeVisible();
  }

  async login(creds: LoginCredentials): Promise<void> {
    await this.emailInput.fill(creds.email);
    await this.passwordInput.fill(creds.password);
    await this.submitButton.click();
  }

  async expectError(text: string | RegExp): Promise<void> {
    await expect(this.errorBox).toContainText(text);
  }
}
