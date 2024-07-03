/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const { chromium } = require('..');
const videoDir = require('path').join(__dirname, '..', '.tmp');

async function go(browser) {
  console.log(`Creating context`);
  const context = await browser.newContext({ recordVideo: { dir: videoDir } });
  const page = await context.newPage();
  await page.goto('https://webkit.org/blog-files/3d-transforms/poster-circle.html');
  await page.waitForTimeout(10000);
  const time = Date.now();
  await context.close();
  console.log(`Closing context for ${Date.now() - time}ms`);
  const video = await page.video();
  console.log(`Recorded video at ${await video.path()}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const promises = [];
  for (let i = 0; i < 10; i++)
    promises.push(go(browser));
  await Promise.all(promises);
  await browser.close();
})();
