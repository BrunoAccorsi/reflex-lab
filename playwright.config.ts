import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm exec next dev --hostname 127.0.0.1",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    env: { MOCK_JEV: "true" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
