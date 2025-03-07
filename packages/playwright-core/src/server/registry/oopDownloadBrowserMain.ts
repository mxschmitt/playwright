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

import fs from 'fs';
import path from 'path';

import { ManualPromise } from '../../utils/isomorphic/manualPromise';
import { httpRequest } from '../utils/network';
import { extract } from '../../zipBundle';

export type DownloadParams = {
  title: string;
  browserDirectory: string;
  url: string;
  executablePath: string | undefined;
  connectionTimeout: number;
  userAgent: string;
};

function log(message: string) {
  process.send?.({ method: 'log', params: { message } });
}

function progress(done: number, total: number) {
  process.send?.({ method: 'progress', params: { done, total } });
}

function browserDirectoryToMarkerFilePath(browserDirectory: string): string {
  return path.join(browserDirectory, 'INSTALLATION_COMPLETE');
}

function downloadFile(options: DownloadParams): Promise<Buffer> {
  let downloadedBytes = 0;
  let totalBytes = 0;

  const promise = new ManualPromise<Buffer>();
  httpRequest({
    url: options.url,
    headers: {
      'User-Agent': options.userAgent,
    },
    timeout: options.connectionTimeout,
  }, response => {
    log(`-- response status code: ${response.statusCode}`);
    if (response.statusCode !== 200) {
      let content = '';
      const handleError = () => {
        const error = new Error(`Download failed: server returned code ${response.statusCode} body '${content}'. URL: ${options.url}`);
        // consume response data to free up memory
        response.resume();
        promise.reject(error);
      };
      response
          .on('data', chunk => content += chunk)
          .on('end', handleError)
          .on('error', handleError);
      return;
    }
    totalBytes = parseInt(response.headers['content-length'] || '0', 10);
    log(`-- total bytes: ${totalBytes}`);
    const chunks: Uint8Array[] = [];
    response.on('end', () => {
      if (downloadedBytes !== totalBytes) {
        log(`-- download failed, size mismatch: ${downloadedBytes} != ${totalBytes}`);
        promise.reject(new Error(`Download failed: size mismatch, file size: ${downloadedBytes}, expected size: ${totalBytes} URL: ${options.url}`));
      } else {
        log(`-- download complete, size: ${downloadedBytes}`);
        promise.resolve(Buffer.concat(chunks));
      }
    });
    response.on('data', (chunk: Uint8Array) => {
      downloadedBytes += chunk.length;
      chunks.push(chunk);
      progress(downloadedBytes, totalBytes);
    });
    response.on('error', (error: any) => {
      if (error?.code === 'ECONNRESET') {
        log(`-- download failed, server closed connection`);
        promise.reject(new Error(`Download failed: server closed connection. URL: ${options.url}`));
      } else {
        log(`-- download failed, unexpected error`);
        promise.reject(new Error(`Download failed: ${error?.message ?? error}. URL: ${options.url}`));
      }
    });
  }, (error: any) => promise.reject(error));
  return promise;
}

async function main(options: DownloadParams) {
  const zipFile = await downloadFile(options);
  log(`SUCCESS downloading ${options.title}`);
  log(`extracting archive`);
  await fs.writeFileSync('/Users/maxschmitt/Developer/playwright/packages/playwright-core/src/server/registry/oopDownloadBrowserMain.zip', zipFile);
  await extract(zipFile, { dir: options.browserDirectory });
  if (options.executablePath) {
    log(`fixing permissions at ${options.executablePath}`);
    await fs.promises.chmod(options.executablePath, 0o755);
  }
  await fs.promises.writeFile(browserDirectoryToMarkerFilePath(options.browserDirectory), '');
}

process.on('message', async message => {
  const { method, params } = message as any;
  if (method === 'download') {
    try {
      await main(params);
      // eslint-disable-next-line no-restricted-properties
      process.exit(0);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      // eslint-disable-next-line no-restricted-properties
      process.exit(1);
    }
  }
});

// eslint-disable-next-line no-restricted-properties
process.on('disconnect', () => { process.exit(0); });
