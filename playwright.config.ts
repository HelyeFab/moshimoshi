import { defineConfig } from '@playwright/test'

export default defineConfig({
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        channel: 'chrome',
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
          chromiumSandbox: false,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-crashpad'],
        },
      },
    },
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH || '/usr/bin/firefox',
        },
      },
    },
  ],
})
