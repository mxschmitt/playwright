/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { debug } from 'playwright-core/lib/utilsBundle';
import type { EnvProducedPayload, ProcessInitParams } from '../common/ipc';
import type { ProtocolResponse } from '../common/process';
import { execArgvWithExperimentalLoaderOptions } from '../transform/esmUtils';
import { assert } from 'playwright-core/lib/utils';
import { esmLoaderRegistered } from '../common/esmLoaderHost';

export type ProcessExitData = {
  unexpectedly: boolean;
  code: number | null;
  signal: NodeJS.Signals | null;
};

export class ProcessHost extends EventEmitter {
  private worker: Worker | undefined;
  private _didSendStop = false;
  private _workerDidExit = false;
  private _didExitAndRanOnExit = false;
  private _runnerScript: string;
  private _lastMessageId = 0;
  private _callbacks = new Map<number, { resolve: (result: any) => void, reject: (error: Error) => void }>();
  private _processName: string;
  private _producedEnv: Record<string, string | undefined> = {};
  private _extraEnv: Record<string, string | undefined>;

  constructor(runnerScript: string, processName: string, env: Record<string, string | undefined>) {
    super();
    this._runnerScript = runnerScript;
    this._processName = processName;
    this._extraEnv = env;
  }

  async startRunner(runnerParams: any, options: { onStdOut?: (chunk: Buffer | string) => void, onStdErr?: (chunk: Buffer | string) => void } = {}): Promise<ProcessExitData | undefined> {
    assert(!this.worker, 'Internal error: starting the same worker twice');

    const workerData = {
      runnerScript: this._runnerScript,
      processName: this._processName,
      env: {
        ...process.env,
        ...this._extraEnv,
        ...(esmLoaderRegistered ? { PW_TS_ESM_LOADER_ON: '1' } : {}),
      },
      runnerParams,
    };

    const workerOptions = {
      env: workerData.env,
      ...(process.env.PW_TS_ESM_LEGACY_LOADER_ON ? { execArgv: execArgvWithExperimentalLoaderOptions() } : {}),
    };

    this.worker = new Worker(require.resolve('../common/process'), { workerData, ...workerOptions });

    this.worker.on('exit', async code => {
      this._workerDidExit = true;
      await this.onExit();
      this._didExitAndRanOnExit = true;
      this.emit('exit', { unexpectedly: !this._didSendStop, code, signal: null } as ProcessExitData);
    });

    this.worker.on('error', error => {
      // Handle worker errors
      this.emit('error', error);
    });

    this.worker.on('message', (message: any) => {
      if (debug.enabled('pw:test:protocol'))
        debug('pw:test:protocol')('◀ RECV ' + JSON.stringify(message));
      if (message.method === '__env_produced__') {
        const producedEnv: EnvProducedPayload = message.params;
        this._producedEnv = Object.fromEntries(producedEnv.map(e => [e[0], e[1] ?? undefined]));
      } else if (message.method === '__dispatch__') {
        const { id, error, method, params, result } = message.params as ProtocolResponse;
        if (id && this._callbacks.has(id)) {
          const { resolve, reject } = this._callbacks.get(id)!;
          this._callbacks.delete(id);
          if (error) {
            const errorObject = new Error(error.message);
            errorObject.stack = error.stack;
            reject(errorObject);
          } else {
            resolve(result);
          }
        } else {
          this.emit(method!, params);
        }
      } else {
        this.emit(message.method!, message.params);
      }
    });

    if (options.onStdOut)
      this.worker.stdout.on('data', options.onStdOut);
    if (options.onStdErr)
      this.worker.stderr.on('data', options.onStdErr);

    const error = await new Promise<ProcessExitData | undefined>(resolve => {
      this.worker!.once('exit', code => resolve({ unexpectedly: true, code, signal: null }));
      this.once('ready', () => resolve(undefined));
    });

    if (error)
      return error;

    const processParams: ProcessInitParams = {
      processName: this._processName
    };

    this.send({
      method: '__init__', params: {
        processParams,
        runnerScript: this._runnerScript,
        runnerParams
      }
    });
  }

  sendMessage(message: { method: string, params?: any }) {
    const id = ++this._lastMessageId;
    this.send({
      method: '__dispatch__',
      params: { id, ...message }
    });
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, { resolve, reject });
    });
  }

  protected sendMessageNoReply(message: { method: string, params?: any }) {
    this.sendMessage(message).catch(() => {});
  }

  protected async onExit() {
  }

  async stop() {
    if (!this._workerDidExit && !this._didSendStop) {
      this.send({ method: '__stop__' });
      this._didSendStop = true;
    }
    if (!this._didExitAndRanOnExit)
      await new Promise(f => this.once('exit', f));
  }

  didSendStop() {
    return this._didSendStop;
  }

  producedEnv() {
    return this._producedEnv;
  }

  private send(message: { method: string, params?: any }) {
    if (debug.enabled('pw:test:protocol'))
      debug('pw:test:protocol')('SEND ► ' + JSON.stringify(message));
    this.worker?.postMessage(message);
  }
}
