import { type Page, type TestInfo, expect } from '@playwright/test';

/**
 * Base class for every Page Object in the Mou test suite.
 * Provides shared helpers: navigation, screenshots, common waits.
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  /**
   * Navigate to a path relative to baseURL and wait for the page to settle.
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle').catch(() => {
      /* networkidle is a hint, not a hard requirement (Next.js streaming) */
    });
  }

  /**
   * Save a full-page screenshot under tests/screenshots/<project>/<name>.png
   * and attach it to the HTML report. Splitting per project avoids desktop
   * and mobile clobbering each other.
   */
  async snap(testInfo: TestInfo, name: string): Promise<void> {
    const project = testInfo.project.name || 'default';
    const path = `tests/screenshots/${project}/${name}.png`;
    const buffer = await this.page.screenshot({ fullPage: true, path });
    await testInfo.attach(`${project}/${name}`, { body: buffer, contentType: 'image/png' });
  }

  async expectUrl(pathRegex: RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pathRegex);
  }
}
