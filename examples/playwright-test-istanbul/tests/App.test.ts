import { test } from './baseFixtures';

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000")
})

test('use Turquoise as a default background color', async ({ page }) => {
  await page.waitForSelector("text=#1abc9c")
});

test('use Red as a background color', async ({ page }) => {
  await page.click("text=Red")
  await page.waitForSelector("text=#e74c3c")
});

test('use Turquoise as a background color', async ({ page }) => {
  await page.click("text=Turquoise")
  await page.waitForSelector("text=#1abc9c")
});
