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
import { Connection } from 'playwright-core/src/client/connection';
import { Playwright } from 'playwright-core/src/client/playwright';
import { makeWaitForNextTask } from 'playwright-core/src/utils/utils';

type PlaywrightClientConnectOptions = {
  wsEndpoint: string;
  timeout?: number
};

export class PlaywrightClient {
  private _playwright: Playwright;
  private _ws: WebSocket;
  private _closePromise: Promise<void>;

  static async connect(options: PlaywrightClientConnectOptions): Promise<PlaywrightClient> {
    const { wsEndpoint, timeout = 30000 } = options;
    const connection = new Connection();
    connection.markAsRemote();
    const ws = new WebSocket(wsEndpoint);
    const waitForNextTask = makeWaitForNextTask();
    connection.onmessage = message => {
      if (ws.readyState === 2 /** CLOSING */ || ws.readyState === 3 /** CLOSED */)
        throw new Error('PlaywrightClient: writing to closed WebSocket connection');
      ws.send(JSON.stringify(message));
    };
    ws.onmessage = message => waitForNextTask(() => connection.dispatch(JSON.parse(message.data)));
    const errorPromise = new Promise((_, reject) => ws.onerror = error => reject(error));
    const closePromise = new Promise((_, reject) => ws.onclose = () => reject(new Error('Connection closed')));
    const playwrightClientPromise = new Promise<PlaywrightClient>((resolve, reject) => {
      let playwright: Playwright;
      ws.onopen = async () => {
        playwright = await connection.initializePlaywright();
        resolve(new PlaywrightClient(playwright, ws));
      };
      ws.onclose = (ev: CloseEvent) => connection.close(ev.reason);
    });
    let timer: NodeJS.Timeout;
    try {
      await Promise.race([
        playwrightClientPromise,
        errorPromise,
        closePromise,
        new Promise((_, reject) => timer = setTimeout(() => reject(`Timeout of ${timeout}ms exceeded while connecting.`), timeout))
      ]);
      return await playwrightClientPromise;
    } finally {
      clearTimeout(timer!);
    }
  }

  constructor(playwright: Playwright, ws: WebSocket) {
    this._playwright = playwright;
    this._ws = ws;
    this._closePromise = new Promise(f => ws.onclose = () => f());
  }

  playwright(): Playwright {
    return this._playwright;
  }

  async close() {
    this._ws.close();
    await this._closePromise;
  }
}