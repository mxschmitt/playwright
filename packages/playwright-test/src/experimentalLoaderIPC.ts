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
/* eslint-disable no-var */

import { EventEmitter } from 'stream';

declare global {
  var __playwrightLoaderMessagePort: MessagePort | undefined;
}

export class LoaderIPCSender {
  private _port: MessagePort;
  constructor(port: MessagePort) {
    this._port = port;
  }

  send(eventName: string, payload: any) {
    console.log('SEND', eventName, payload, new Error().stack);
    this._port.postMessage({ eventName, payload });
  }
}

export class LoaderIPCReceiver extends EventEmitter {
  private _port: MessagePort;
  constructor(port: MessagePort) {
    super();
    this._port = port;
    this._port.onmessage = (event: MessageEvent) => {
      const { eventName, payload } = event.data;
      this.emit(eventName, payload);
    };
  }
}

export const ipcReceiver = globalThis.__playwrightLoaderMessagePort ? new LoaderIPCReceiver(globalThis.__playwrightLoaderMessagePort) : undefined;
