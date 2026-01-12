import { defineConfig } from '@playwright/test'

const hasAuthSetupEnv = Boolean(
  process.env.E2E_FREE_EMAIL &&
    process.env.E2E_FREE_PASSWORD &&
    process.env.E2E_PREMIUM_EMAIL &&
    process.env.E2E_PREMIUM_PASSWORD
)

const chromiumUse =
  process.env.PLAYWRIGHT_USE_SYSTEM === '1'
    ? {
        channel: 'chrome',
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
          chromiumSandbox: false,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-crashpad'],
        },
      }
    : {
        browserName: 'chromium',
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      }

const projects = []

if (hasAuthSetupEnv) {
  projects.push({
    name: 'setup',
    testMatch: /auth\.setup\.ts/,
    use: chromiumUse,
  })
}

projects.push({
  name: 'chromium',
  use: chromiumUse,
  ...(hasAuthSetupEnv ? { dependencies: ['setup'] } : {}),
})

projects.push({
  name: 'firefox',
  use: {
    browserName: 'firefox',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH || '/usr/bin/firefox',
    },
  },
})

export default defineConfig({
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
  },
  projects,
})
