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

import { baseTest } from '../config/baseTest';
import path from 'path';
import type { PageTestFixtures, PageWorkerFixtures } from '../page/pageTestApi';
import type { TraceViewerFixtures } from '../config/traceViewerFixtures';
import { traceViewerFixtures } from '../config/traceViewerFixtures';
export { expect } from '@playwright/test';
import { TestChildProcess } from '../config/commonFixtures';
import { chromiumSwitches } from '../../packages/playwright-core/lib/server/chromium/chromiumSwitches';
import { ManualPromise } from '../../packages/playwright-core/lib/utils/manualPromise';

export const cefTest = baseTest.extend<TraceViewerFixtures>(traceViewerFixtures).extend<PageTestFixtures, PageWorkerFixtures>({
  browserVersion: [process.env.PWTEST_WEBVIEW2_CHROMIUM_VERSION, { scope: 'worker' }],
  browserMajorVersion: [({ browserVersion }, use) => use(Number(browserVersion.split('.')[0])), { scope: 'worker' }],
  isAndroid: [false, { scope: 'worker' }],
  isElectron: [false, { scope: 'worker' }],
  isWebView2: [true, { scope: 'worker' }],

  browser: [async ({ playwright }, use, testInfo) => {
    const cdpPort = 10000 + testInfo.workerIndex;
    const waitForDevTools = new ManualPromise();
    const spawnedProcess = new TestChildProcess({
      command: [
        path.join('/Users/maxschmitt/code/chromium_git/chromium/src/out/Debug_GN_arm64/cefsimple.app/Contents/MacOS/cefsimple'),
        `--remote-debugging-port=${cdpPort}`,
        `--url=about:blank`,
        ...chromiumSwitches,
      ],
      shell: true,
      onOutput: data => {
        if (data.toString().includes('DevTools listening on'))
          waitForDevTools.resolve();
      }
    });
    await waitForDevTools;
    const browser = await playwright.chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
    await use(browser);
    await browser.close();
    await spawnedProcess.kill('SIGKILL');
  }, { scope: 'worker' }],

  context: async ({ browser }, use) => {
    await use(browser.contexts()[0]);
  },
  page: async ({ context }, use) => {
    const page = context.pages()[0];
    await page.goto('about:blank', { timeout: 0 });
    await use(page);
  }
});
