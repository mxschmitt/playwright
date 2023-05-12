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

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { sourceMapSupport } from '../utilsBundle';
import { mainThreadSender } from '../experimentalLoader';
import { ipcReceiver } from '../experimentalLoaderIPC';

export type MemoryCache = {
  codePath: string;
  sourceMapPath: string;
  moduleUrl?: string;
};

const version = 13;

const cacheDir = process.env.PWTEST_CACHE_DIR || (() => {
  if (process.platform === 'win32')
    return path.join(os.tmpdir(), `playwright-transform-cache`);
  // Use `geteuid()` instead of more natural `os.userInfo().username`
  // since `os.userInfo()` is not always available.
  // Note: `process.geteuid()` is not available on windows.
  // See https://github.com/microsoft/playwright/issues/22721
  return path.join(os.tmpdir(), `playwright-transform-cache-` + process.geteuid());
})();

const sourceMaps: Map<string, string> = new Map();
const memoryCache = new Map<string, MemoryCache>();
// Dependencies resolved by the loader.
const fileDependencies = new Map<string, Set<string>>();
// Dependencies resolved by the external bundler.
const externalDependencies = new Map<string, Set<string>>();

Error.stackTraceLimit = 200;

sourceMapSupport.install({
  environment: 'node',
  handleUncaughtExceptions: false,
  retrieveSourceMap(source) {
    if (!sourceMaps.has(source))
      return null;
    const sourceMapPath = sourceMaps.get(source)!;
    if (!fs.existsSync(sourceMapPath))
      return null;
    return {
      map: JSON.parse(fs.readFileSync(sourceMapPath, 'utf-8')),
      url: source
    };
  }
});

function _innerAddToCompilationCache(filename: string, options: { codePath: string, sourceMapPath: string, moduleUrl?: string }) {
  sourceMaps.set(options.moduleUrl || filename, options.sourceMapPath);
  memoryCache.set(filename, options);
  mainThreadSender?.send('sourceMaps', { key: options.moduleUrl || filename, value: options.sourceMapPath });
}

ipcReceiver?.on('sourceMaps', (message: { key: string, value: string }) => sourceMaps.set(message.key, message.value));
ipcReceiver?.on('fileDependencies', (message: { key: string, value: string[] }) => fileDependencies.set(message.key, new Set(message.value)));
ipcReceiver?.on('depsCollector', items => {
  depsCollector?.clear();
  for (const item of items)
    depsCollector?.add(item);
});

export function getFromCompilationCache(filename: string, code: string, moduleUrl?: string): { cachedCode?: string, addToCache?: (code: string, map?: any) => void } {
  // First check the memory cache by filename, this cache will always work in the worker,
  // because we just compiled this file in the loader.
  const cache = memoryCache.get(filename);
  if (cache?.codePath)
    return { cachedCode: fs.readFileSync(cache.codePath, 'utf-8') };

  // Then do the disk cache, this cache works between the Playwright Test runs.
  const isModule = !!moduleUrl;
  const cachePath = calculateCachePath(code, filename, isModule);
  const codePath = cachePath + '.js';
  const sourceMapPath = cachePath + '.map';
  if (fs.existsSync(codePath)) {
    _innerAddToCompilationCache(filename, { codePath, sourceMapPath, moduleUrl });
    return { cachedCode: fs.readFileSync(codePath, 'utf8') };
  }

  return {
    addToCache: (code: string, map: any) => {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      if (map)
        fs.writeFileSync(sourceMapPath, JSON.stringify(map), 'utf8');
      fs.writeFileSync(codePath, code, 'utf8');
      _innerAddToCompilationCache(filename, { codePath, sourceMapPath, moduleUrl });
    }
  };
}

export function serializeCompilationCache(): any {
  return {
    sourceMaps: [...sourceMaps.entries()],
    memoryCache: [...memoryCache.entries()],
    fileDependencies: [...fileDependencies.entries()].map(([filename, deps]) => ([filename, [...deps]])),
    externalDependencies: [...externalDependencies.entries()].map(([filename, deps]) => ([filename, [...deps]])),
  };
}

export function clearCompilationCache() {
  sourceMaps.clear();
  memoryCache.clear();
}

export function addToCompilationCache(payload: any) {
  for (const entry of payload.sourceMaps)
    sourceMaps.set(entry[0], entry[1]);
  for (const entry of payload.memoryCache)
    memoryCache.set(entry[0], entry[1]);
  for (const entry of payload.fileDependencies) {
    fileDependencies.set(entry[0], new Set(entry[1]));
    mainThreadSender?.send('fileDependencies', { key: entry[0], value: entry[1] });
  }
  for (const entry of payload.externalDependencies)
    externalDependencies.set(entry[0], new Set(entry[1]));
}

function calculateCachePath(content: string, filePath: string, isModule: boolean): string {
  const hash = crypto.createHash('sha1')
      .update(process.env.PW_TEST_SOURCE_TRANSFORM || '')
      .update(isModule ? 'esm' : 'no_esm')
      .update(content)
      .update(filePath)
      .update(String(version))
      .digest('hex');
  const fileName = path.basename(filePath, path.extname(filePath)).replace(/\W/g, '') + '_' + hash;
  return path.join(cacheDir, hash[0] + hash[1], fileName);
}

// Since ESM and CJS collect dependencies differently,
// we go via the global state to collect them.
let depsCollector: Set<string> | undefined;

export function startCollectingFileDeps() {
  console.log('startCollectingFileDeps');
  depsCollector = new Set();
}

export function stopCollectingFileDeps(filename: string) {
  if (!depsCollector)
    return;
  depsCollector.delete(filename);
  for (const dep of depsCollector) {
    if (belongsToNodeModules(dep))
      depsCollector.delete(dep);
  }
  console.log('fileDependencies2', filename, [...depsCollector]);
  fileDependencies.set(filename, depsCollector);
  mainThreadSender?.send('fileDependencies', { key: filename, value: [...depsCollector] });
  depsCollector = undefined;
  
}


class ObservedSet<T> implements Set<T> {
  constructor(private readonly base: Set<T>, private readonly callback: (value: Set<T>) => void) { }
  add(value: T): this {
    this.base.add(value);
    this.callback(this.base);
    return this;
  }
  clear(): void {
    this.base.clear();
    this.callback(this.base);
  }
  delete(value: T): boolean {
    const removed = this.base.delete(value);
    this.callback(this.base);
    return removed;
  }
  forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: any): void {
    return this.base.forEach(callbackfn, thisArg);
  }
  has(value: T): boolean {
    return this.base.has(value);
  }
  get size(): number {
    return this.base.size;
  }
  entries(): IterableIterator<[T, T]> {
    return this.base.entries();
  }
  keys(): IterableIterator<T> {
    return this.base.keys();
  }
  values(): IterableIterator<T> {
    return this.base.values();
  }
  [Symbol.iterator](): IterableIterator<T> {
    return this.base[Symbol.iterator]();
  }
  get [Symbol.toStringTag]() {
    return this.base[Symbol.toStringTag];
  }
}

export function currentFileDepsCollector(): Set<string> | undefined {
  console.log('currentFileDepsCollector', depsCollector)
  if (!depsCollector)
    return;
  return new ObservedSet(depsCollector, deps => mainThreadSender?.send('depsCollector', deps));
}

export function setExternalDependencies(filename: string, deps: string[]) {
  const depsSet = new Set(deps.filter(dep => !belongsToNodeModules(dep) && dep !== filename));
  externalDependencies.set(filename, depsSet);
}

export function fileDependenciesForTest() {
  return fileDependencies;
}

export function collectAffectedTestFiles(dependency: string, testFileCollector: Set<string>) {
  testFileCollector.add(dependency);
  for (const [testFile, deps] of fileDependencies) {
    if (deps.has(dependency))
      testFileCollector.add(testFile);
  }
  for (const [testFile, deps] of externalDependencies) {
    if (deps.has(dependency))
      testFileCollector.add(testFile);
  }
}

export function dependenciesForTestFile(filename: string): Set<string> {
  return fileDependencies.get(filename) || new Set();
}

// These two are only used in the dev mode, they are specifically excluding
// files from packages/playwright*. In production mode, node_modules covers
// that.
const kPlaywrightInternalPrefix = path.resolve(__dirname, '../../../playwright');
const kPlaywrightCoveragePrefix = path.resolve(__dirname, '../../../../tests/config/coverage.js');

export function belongsToNodeModules(file: string) {
  if (file.includes(`${path.sep}node_modules${path.sep}`))
    return true;
  if (file.startsWith(kPlaywrightInternalPrefix) && file.endsWith('.js'))
    return true;
  if (file.startsWith(kPlaywrightCoveragePrefix) && file.endsWith('.js'))
    return true;
  return false;
}
