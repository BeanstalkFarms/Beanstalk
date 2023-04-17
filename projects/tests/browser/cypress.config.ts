import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    setupNodeEvents: (on, config) => ({
      ...config,
      baseUrl: "http://localhost:4173/#",
      fileServerFolder: "",
      screenshotOnRunFailure: false,
      video: false,
      videoUploadOnPasses: false,
      // XL viewport
      viewportHeight: 900,
      viewportWidth: 1550,
      browsers: config.browsers.filter((b) => b.name === "chrome"),
      supportFolder: "cypress/support"
    })
  }
});
