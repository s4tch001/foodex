import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '../../.env' });

const executablePath = process.env.PLAYWRIGHT_CHROME_PATH;

if (!executablePath) {
  throw new Error('PLAYWRIGHT_CHROME_PATH must point to a local Chrome executable.');
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath,
    },
  },
  webServer: {
    command: 'npm.cmd run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
});
