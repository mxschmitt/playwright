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

import { PlaywrightConnection } from './playwrightConnection';
import { createPlaywright } from '../server/playwright';
import { Semaphore } from '../utils/isomorphic/semaphore';
import { DEFAULT_PLAYWRIGHT_LAUNCH_TIMEOUT } from '../utils/isomorphic/time';
import { WSServer } from '../server/utils/wsServer';
import { wrapInASCIIBox } from '../server/utils/ascii';
import { getPlaywrightVersion } from '../server/utils/userAgent';

import type { ClientType } from './playwrightConnection';
import type { SocksProxy } from '../server/utils/socksProxy';
import type { AndroidDevice } from '../server/android/android';
import type { Browser } from '../server/browser';
import type { Playwright } from '../server/playwright';
import type  { LaunchOptions } from '../server/types';


type ServerOptions = {
  path: string;
  maxConnections: number;
  mode: 'default' | 'launchServer' | 'launchServerShared' | 'extension';
  preLaunchedBrowser?: Browser;
  preLaunchedAndroidDevice?: AndroidDevice;
  preLaunchedSocksProxy?: SocksProxy;
};

export class PlaywrightServer {
  private _playwright: Playwright;
  private _options: ServerOptions;
  private _wsServer: WSServer;

  constructor(options: ServerOptions) {
    this._options = options;
    if (options.preLaunchedBrowser)
      this._playwright = options.preLaunchedBrowser.attribution.playwright;
    if (options.preLaunchedAndroidDevice)
      this._playwright = options.preLaunchedAndroidDevice._android.attribution.playwright;
    this._playwright ??= createPlaywright({ sdkLanguage: 'javascript', isServer: true });

    const browserSemaphore = new Semaphore(this._options.maxConnections);
    const controllerSemaphore = new Semaphore(1);
    const reuseBrowserSemaphore = new Semaphore(1);

    this._wsServer = new WSServer({
      onRequest: (request, response) => {
        if (request.method === 'GET' && request.url === '/json') {
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({
            wsEndpointPath: this._options.path,
          }));
          return;
        }
        response.end('Running');
      },

      onUpgrade: (request, socket) => {
        const uaError = userAgentVersionMatchesErrorMessage(request.headers['user-agent'] || '');
        if (uaError)
          return { error: `HTTP/${request.httpVersion} 428 Precondition Required\r\n\r\n${uaError}` };
      },

      onHeaders: headers => {
        if (process.env.PWTEST_SERVER_WS_HEADERS)
          headers.push(process.env.PWTEST_SERVER_WS_HEADERS!);
      },

      onConnection: (request, url, ws, id) => {
        const browserHeader = request.headers['x-playwright-browser'];
        const browserName = url.searchParams.get('browser') || (Array.isArray(browserHeader) ? browserHeader[0] : browserHeader) || null;
        const proxyHeader = request.headers['x-playwright-proxy'];
        const proxyValue = url.searchParams.get('proxy') || (Array.isArray(proxyHeader) ? proxyHeader[0] : proxyHeader);

        const launchOptionsHeader = request.headers['x-playwright-launch-options'] || '';
        const launchOptionsHeaderValue = Array.isArray(launchOptionsHeader) ? launchOptionsHeader[0] : launchOptionsHeader;
        const launchOptionsParam = url.searchParams.get('launch-options');
        let launchOptions: LaunchOptions = { timeout: DEFAULT_PLAYWRIGHT_LAUNCH_TIMEOUT };
        try {
          launchOptions = JSON.parse(launchOptionsParam || launchOptionsHeaderValue);
        } catch (e) {
        }

        // Instantiate playwright for the extension modes.
        const isExtension = this._options.mode === 'extension';
        let clientType: ClientType = 'launch-browser';
        let semaphore: Semaphore = browserSemaphore;
        if (isExtension && url.searchParams.has('debug-controller')) {
          clientType = 'controller';
          semaphore = controllerSemaphore;
        } else if (isExtension) {
          clientType = 'reuse-browser';
          semaphore = reuseBrowserSemaphore;
        } else if (this._options.mode === 'launchServer' || this._options.mode === 'launchServerShared') {
          clientType = 'pre-launched-browser-or-android';
          semaphore = browserSemaphore;
        }

        return new PlaywrightConnection(
            semaphore.acquire(),
            clientType, ws,
            {
              socksProxyPattern: proxyValue,
              browserName,
              launchOptions,
              allowFSPaths: this._options.mode === 'extension',
              sharedBrowser: this._options.mode === 'launchServerShared',
            },
            this._playwright,
            {
              browser: this._options.preLaunchedBrowser,
              androidDevice: this._options.preLaunchedAndroidDevice,
              socksProxy: this._options.preLaunchedSocksProxy,
            },
            id, () => semaphore.release());
      },
    });
  }

  async listen(port: number = 0, hostname?: string): Promise<string> {
    return this._wsServer.listen(port, hostname, this._options.path);
  }

  async close() {
    await this._wsServer.close();
  }
}

function userAgentVersionMatchesErrorMessage(userAgent: string) {
  const match = userAgent.match(/^Playwright\/(\d+\.\d+\.\d+)/);
  if (!match) {
    // Cannot parse user agent - be lax.
    return;
  }
  const received = match[1].split('.').slice(0, 2).join('.');
  const expected = getPlaywrightVersion(true);
  if (received !== expected) {
    return wrapInASCIIBox([
      `Playwright version mismatch:`,
      `  - server version: v${expected}`,
      `  - client version: v${received}`,
      ``,
      `If you are using VSCode extension, restart VSCode.`,
      ``,
      `If you are connecting to a remote service,`,
      `keep your local Playwright version in sync`,
      `with the remote service version.`,
      ``,
      `<3 Playwright Team`
    ].join('\n'), 1);
  }
}
