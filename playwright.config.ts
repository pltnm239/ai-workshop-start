import { defineConfig } from '@playwright/test';

const PORT = 4318;

export default defineConfig({
  testDir: 'tests/ui',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/report.json' }]],
  expect: {
    toHaveScreenshot: { maxDiffPixels: 0, threshold: 0, animations: 'disabled', caret: 'hide', scale: 'css', stylePath: './tests/ui/screenshot.css' },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    trace: 'on',
  },
  webServer: {
    command: 'node tests/ui/server.ts',
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    env: { PORT: String(PORT) },
  },
});
