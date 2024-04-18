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
  // https://cef-builds.spotifycdn.com/index.html
  // https://cef-builds.spotifycdn.com/cef_binary_123.0.12%2Bgb15e34c%2Bchromium-123.0.6312.107_macosarm64_client.tar.bz2
  const cdpPort = 9876;
  const spawnedProcess = childProcess.spawn(path.join('/Users/maxschmitt/code/chromium_git/chromium/src/out/Debug_GN_arm64/cefsimple.app/Contents/MacOS/cefsimple'), [
    `--remote-debugging-port=${cdpPort}`,
    `--url=about:blank`,
  ], {
    shell: true,
    detached: true,
    stdio: 'pipe',
  });
  spawnedProcess.stdout.on('data', data => {
    if (data.toString().includes('Opening in existing browser session.'))
      throw new Error('Failed to start CEF - another instance is already running');
  });
  await new Promise<void>(resolve => spawnedProcess.stderr.on('data', (data: Buffer): void => {
    if (data.toString().includes('DevTools listening on'))
      resolve();
  }));
  const browser = await playwright.chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
  console.log(`Using CEF with Chromium version ${browser.version()}`);
  const page = browser.contexts()[0].pages()[0];
  await page.goto('data:text/html,');
  const chromeVersion = await page.evaluate(() => navigator.userAgent.match(/Chrome\/(.*?) /)[1]);
  process.env.PWTEST_WEBVIEW2_CHROMIUM_VERSION = chromeVersion;
  await browser.close();
  const waitForExit = new Promise<void>(resolve => spawnedProcess.on('exit', resolve));
  process.kill(-spawnedProcess.pid);
  await waitForExit;
};
