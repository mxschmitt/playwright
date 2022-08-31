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
import path from 'path';
import childProcess from 'child_process';
import playwright from 'playwright';

export default async () => {
  const executable = path.join(__dirname, 'webview2-app\\bin\\Debug\\net6.0-windows\\webview2.exe');
  const cdpPort = 9876;
  const spawnedProcess = childProcess.spawn(executable, {
    shell: true,
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${cdpPort}`,
    }
  });
  await new Promise<void>(resolve => spawnedProcess.stdout.on('data', (data: Buffer): void => {
    if (data.toString().includes('WebView2 initialized'))
      resolve();
  }));
  const browser = await playwright.chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  const chromeVersion = await browser.contexts()[0].pages()[0].evaluate(() => navigator.userAgent.match(/Chrome\/(.*?) /)[1]);
  process.env.PWTEST_WEBVIEW2_CHROMIUM_VERSION = chromeVersion;
  await browser.close();
  childProcess.spawnSync(`taskkill /pid ${spawnedProcess.pid} /T /F`, { shell: true });
};
