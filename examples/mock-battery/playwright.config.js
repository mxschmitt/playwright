// @ts-check
const path = require('path')

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  webServer: {
    port: 9900,
    command: 'npm run start',
  },
  use: {
    baseURL: 'http://localhost:9900',
  },
  // Test directory
  testDir: path.join(__dirname, 'tests'),
});
