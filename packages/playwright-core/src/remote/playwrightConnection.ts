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

import { SocksProxy } from '../server/utils/socksProxy';
import { DispatcherConnection, PlaywrightDispatcher, RootDispatcher } from '../server';
import { AndroidDevice } from '../server/android/android';
import { Browser } from '../server/browser';
import { DebugControllerDispatcher } from '../server/dispatchers/debugControllerDispatcher';
import { serverSideCallMetadata } from '../server/instrumentation';
import { assert } from '../utils/isomorphic/assert';
import { isUnderTest } from '../server/utils/debug';
import { startProfiling, stopProfiling } from '../server/utils/profiler';
import { monotonicTime } from '../utils';
import { debugLogger } from '../server/utils/debugLogger';

import type { DispatcherScope, Playwright } from '../server';
import type { LaunchOptions } from '../server/types';
import type { WebSocket } from '../utilsBundle';
import type * as channels from '@protocol/channels';

export type ClientType = 'controller' | 'launch-browser' | 'reuse-browser' | 'pre-launched-browser-or-android';

type Options = {
  allowFSPaths: boolean,
  socksProxyPattern: string | undefined,
  browserName: string | null,
  launchOptions: LaunchOptions,
  sharedBrowser?: boolean,
};

type PreLaunched = {
  browser?: Browser | undefined;
  androidDevice?: AndroidDevice | undefined;
  socksProxy?: SocksProxy | undefined;
};

export class PlaywrightConnection {
  private _ws: WebSocket;
  private _onClose: () => void;
  private _dispatcherConnection: DispatcherConnection;
  private _cleanups: (() => Promise<void>)[] = [];
  private _id: string;
  private _disconnected = false;
  private _playwright: Playwright;
  private _preLaunched: PreLaunched;
  private _options: Options;
  private _root: DispatcherScope;
  private _profileName: string;

  constructor(lock: Promise<void>, clientType: ClientType, ws: WebSocket, options: Options, playwright: Playwright, preLaunched: PreLaunched, id: string, onClose: () => void) {
    this._ws = ws;
    this._playwright = playwright;
    this._preLaunched = preLaunched;
    this._options = options;
    options.launchOptions = filterLaunchOptions(options.launchOptions, options.allowFSPaths);
    if (clientType === 'pre-launched-browser-or-android')
      assert(preLaunched.browser || preLaunched.androidDevice);
    this._onClose = onClose;
    this._id = id;
    this._profileName = `${new Date().toISOString()}-${clientType}`;

    this._dispatcherConnection = new DispatcherConnection();
    this._dispatcherConnection.onmessage = async message => {
      await lock;
      if (ws.readyState !== ws.CLOSING) {
        const messageString = JSON.stringify(message);
        if (debugLogger.isEnabled('server:channel'))
          debugLogger.log('server:channel', `[${this._id}] ${monotonicTime() * 1000} SEND ► ${messageString}`);
        if (debugLogger.isEnabled('server:metadata'))
          this.logServerMetadata(message, messageString, 'SEND');
        ws.send(messageString);
      }
    };
    ws.on('message', async (message: string) => {
      await lock;
      const messageString = Buffer.from(message).toString();
      const jsonMessage = JSON.parse(messageString);
      if (debugLogger.isEnabled('server:channel'))
        debugLogger.log('server:channel', `[${this._id}] ${monotonicTime() * 1000} ◀ RECV ${messageString}`);
      if (debugLogger.isEnabled('server:metadata'))
        this.logServerMetadata(jsonMessage, messageString, 'RECV');
      this._dispatcherConnection.dispatch(jsonMessage);
    });

    ws.on('close', () => this._onDisconnect());
    ws.on('error', (error: Error) => this._onDisconnect(error));

    if (clientType === 'controller') {
      this._root = this._initDebugControllerMode();
      return;
    }

    this._root = new RootDispatcher(this._dispatcherConnection, async (scope, options) => {
      await startProfiling();
      if (clientType === 'reuse-browser')
        return await this._initReuseBrowsersMode(scope, options);
      if (clientType === 'pre-launched-browser-or-android')
        return this._preLaunched.browser ? await this._initPreLaunchedBrowserMode(scope, options) : await this._initPreLaunchedAndroidMode(scope);
      if (clientType === 'launch-browser')
        return await this._initLaunchBrowserMode(scope, options);
      throw new Error('Unsupported client type: ' + clientType);
    });
  }

  private async _initLaunchBrowserMode(scope: RootDispatcher, options: channels.RootInitializeParams) {
    debugLogger.log('server', `[${this._id}] engaged launch mode for "${this._options.browserName}"`);
    const ownedSocksProxy = await this._createOwnedSocksProxy();
    const browser = await this._playwright[this._options.browserName as 'chromium'].launch(serverSideCallMetadata(), this._options.launchOptions);
    browser.options.sdkLanguage = options.sdkLanguage;

    this._cleanups.push(() => browser.close({ reason: 'Connection terminated' }));
    browser.on(Browser.Events.Disconnected, () => {
      // Underlying browser did close for some reason - force disconnect the client.
      this.close({ code: 1001, reason: 'Browser closed' });
    });

    return new PlaywrightDispatcher(scope, this._playwright, { socksProxy: ownedSocksProxy, preLaunchedBrowser: browser, denyLaunch: true, });
  }

  private async _initPreLaunchedBrowserMode(scope: RootDispatcher, options: channels.RootInitializeParams) {
    debugLogger.log('server', `[${this._id}] engaged pre-launched (browser) mode`);

    // Note: connected client owns the socks proxy and configures the pattern.
    this._preLaunched.socksProxy?.setPattern(this._options.socksProxyPattern);

    const browser = this._preLaunched.browser!;
    browser.options.sdkLanguage = options.sdkLanguage;
    browser.on(Browser.Events.Disconnected, () => {
      // Underlying browser did close for some reason - force disconnect the client.
      this.close({ code: 1001, reason: 'Browser closed' });
    });

    const playwrightDispatcher = new PlaywrightDispatcher(scope, this._playwright, {
      socksProxy: this._preLaunched.socksProxy,
      preLaunchedBrowser: browser,
      sharedBrowser: this._options.sharedBrowser,
      denyLaunch: true,
    });
    // In pre-launched mode, keep only the pre-launched browser.
    for (const b of this._playwright.allBrowsers()) {
      if (b !== browser)
        await b.close({ reason: 'Connection terminated' });
    }
    this._cleanups.push(() => playwrightDispatcher.cleanup());
    return playwrightDispatcher;
  }

  private async _initPreLaunchedAndroidMode(scope: RootDispatcher) {
    debugLogger.log('server', `[${this._id}] engaged pre-launched (Android) mode`);
    const androidDevice = this._preLaunched.androidDevice!;
    androidDevice.on(AndroidDevice.Events.Close, () => {
      // Underlying browser did close for some reason - force disconnect the client.
      this.close({ code: 1001, reason: 'Android device disconnected' });
    });
    const playwrightDispatcher = new PlaywrightDispatcher(scope, this._playwright, { preLaunchedAndroidDevice: androidDevice, denyLaunch: true });
    this._cleanups.push(() => playwrightDispatcher.cleanup());
    return playwrightDispatcher;
  }

  private _initDebugControllerMode(): DebugControllerDispatcher {
    debugLogger.log('server', `[${this._id}] engaged reuse controller mode`);
    // Always create new instance based on the reused Playwright instance.
    return new DebugControllerDispatcher(this._dispatcherConnection, this._playwright.debugController);
  }

  private async _initReuseBrowsersMode(scope: RootDispatcher, options: channels.RootInitializeParams) {
    // Note: reuse browser mode does not support socks proxy, because
    // clients come and go, while the browser stays the same.

    debugLogger.log('server', `[${this._id}] engaged reuse browsers mode for ${this._options.browserName}`);

    const requestedOptions = launchOptionsHash(this._options.launchOptions);
    let browser = this._playwright.allBrowsers().find(b => {
      if (b.options.name !== this._options.browserName)
        return false;
      const existingOptions = launchOptionsHash(b.options.originalLaunchOptions);
      return existingOptions === requestedOptions;
    });

    // Close remaining browsers of this type+channel. Keep different browser types for the speed.
    for (const b of this._playwright.allBrowsers()) {
      if (b === browser)
        continue;
      if (b.options.name === this._options.browserName && b.options.channel === this._options.launchOptions.channel)
        await b.close({ reason: 'Connection terminated' });
    }

    if (!browser) {
      browser = await this._playwright[(this._options.browserName || 'chromium') as 'chromium'].launch(serverSideCallMetadata(), {
        ...this._options.launchOptions,
        headless: !!process.env.PW_DEBUG_CONTROLLER_HEADLESS,
      });
      browser.on(Browser.Events.Disconnected, () => {
        // Underlying browser did close for some reason - force disconnect the client.
        this.close({ code: 1001, reason: 'Browser closed' });
      });
    }
    browser.options.sdkLanguage = options.sdkLanguage;

    this._cleanups.push(async () => {
      // Don't close the pages so that user could debug them,
      // but close all the empty browsers and contexts to clean up.
      for (const browser of this._playwright.allBrowsers()) {
        for (const context of browser.contexts()) {
          if (!context.pages().length)
            await context.close({ reason: 'Connection terminated' });
          else
            await context.stopPendingOperations('Connection closed');
        }
        if (!browser.contexts())
          await browser.close({ reason: 'Connection terminated' });
      }
    });

    const playwrightDispatcher = new PlaywrightDispatcher(scope, this._playwright, { preLaunchedBrowser: browser, denyLaunch: true });
    return playwrightDispatcher;
  }

  private async _createOwnedSocksProxy(): Promise<SocksProxy | undefined> {
    if (!this._options.socksProxyPattern) {
      this._options.launchOptions.socksProxyPort = undefined;
      return;
    }
    const socksProxy = new SocksProxy();
    socksProxy.setPattern(this._options.socksProxyPattern);
    this._options.launchOptions.socksProxyPort = await socksProxy.listen(0);
    debugLogger.log('server', `[${this._id}] started socks proxy on port ${this._options.launchOptions.socksProxyPort}`);
    this._cleanups.push(() => socksProxy.close());
    return socksProxy;
  }

  private async _onDisconnect(error?: Error) {
    this._disconnected = true;
    debugLogger.log('server', `[${this._id}] disconnected. error: ${error}`);
    this._root._dispose();
    debugLogger.log('server', `[${this._id}] starting cleanup`);
    for (const cleanup of this._cleanups)
      await cleanup().catch(() => {});
    await stopProfiling(this._profileName);
    this._onClose();
    debugLogger.log('server', `[${this._id}] finished cleanup`);
  }

  private logServerMetadata(message: object, messageString: string, direction: 'SEND' | 'RECV') {
    const serverLogMetadata = {
      wallTime: Date.now(),
      id: (message as any).id,
      guid: (message as any).guid,
      method: (message as any).method,
      payloadSizeInBytes: Buffer.byteLength(messageString, 'utf-8')
    };
    debugLogger.log('server:metadata', (direction === 'SEND' ? 'SEND ► ' : '◀ RECV ') + JSON.stringify(serverLogMetadata));
  }

  async close(reason?: { code: number, reason: string }) {
    if (this._disconnected)
      return;
    debugLogger.log('server', `[${this._id}] force closing connection: ${reason?.reason || ''} (${reason?.code || 0})`);
    try {
      this._ws.close(reason?.code, reason?.reason);
    } catch (e) {
    }
  }
}

function launchOptionsHash(options: LaunchOptions) {
  const copy = { ...options };
  for (const k of Object.keys(copy)) {
    const key = k as keyof LaunchOptions;
    if (copy[key] === defaultLaunchOptions[key])
      delete copy[key];
  }
  for (const key of optionsThatAllowBrowserReuse)
    delete copy[key];
  return JSON.stringify(copy);
}

function filterLaunchOptions(options: LaunchOptions, allowFSPaths: boolean): LaunchOptions {
  return {
    channel: options.channel,
    args: options.args,
    ignoreAllDefaultArgs: options.ignoreAllDefaultArgs,
    ignoreDefaultArgs: options.ignoreDefaultArgs,
    timeout: options.timeout,
    headless: options.headless,
    proxy: options.proxy,
    chromiumSandbox: options.chromiumSandbox,
    firefoxUserPrefs: options.firefoxUserPrefs,
    slowMo: options.slowMo,
    executablePath: (isUnderTest() || allowFSPaths) ? options.executablePath : undefined,
    downloadsPath: allowFSPaths ? options.downloadsPath : undefined,
  };
}

const defaultLaunchOptions: Partial<LaunchOptions> = {
  ignoreAllDefaultArgs: false,
  handleSIGINT: false,
  handleSIGTERM: false,
  handleSIGHUP: false,
  headless: true,
  devtools: false,
};

const optionsThatAllowBrowserReuse: (keyof LaunchOptions)[] = [
  'headless',
  'timeout',
  'tracesDir',
];
