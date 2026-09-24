import { defineConfig, devices } from '@playwright/test';
import { environment } from './config/environment';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /*
   * Console progress plus an HTML report that never auto-opens a server.
   * On CI, JUnit XML is added for Jenkins; the pipeline can redirect it per run.
   */
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ...(process.env.CI
      ? [['junit', { outputFile: process.env.PLAYWRIGHT_JUNIT_OUTPUT_FILE ?? 'reports/junit.xml' }] as const]
      : []),
  ],
  use: {
    /* Keep diagnostics only for failed tests. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'api',
      testDir: './tests/api',
    },
    {
      name: 'chromium',
      testDir: './tests/ui',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: environment.uiUrl,
      },
    },
  ],
});
