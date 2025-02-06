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
  zipPath: string;
  executablePath: string | undefined;
  connectionTimeout: number;
  userAgent: string;
  progress: (downloadedBytes: number, totalBytes: number) => void
  log(message: string): void;
};

function browserDirectoryToMarkerFilePath(browserDirectory: string): string {
  return path.join(browserDirectory, 'INSTALLATION_COMPLETE');
}

function downloadFile(options: DownloadParams): Promise<void> {
  let downloadedBytes = 0;
  let totalBytes = 0;

  const promise = new ManualPromise<void>();

  httpRequest({
    url: options.url,
    headers: {
      'User-Agent': options.userAgent,
    },
    timeout: options.connectionTimeout,
  }, response => {
    options.log(`-- response status code: ${response.statusCode}`);
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
    options.log(`-- total bytes: ${totalBytes}`);
    const file = fs.createWriteStream(options.zipPath);
    file.on('finish', () => {
      if (downloadedBytes !== totalBytes) {
        options.log(`-- download failed, size mismatch: ${downloadedBytes} != ${totalBytes}`);
        promise.reject(new Error(`Download failed: size mismatch, file size: ${downloadedBytes}, expected size: ${totalBytes} URL: ${options.url}`));
      } else {
        options.log(`-- download complete, size: ${downloadedBytes}`);
        promise.resolve();
      }
    });
    file.on('error', error => promise.reject(error));
    response.pipe(file);
    response.on('data', onData);
    response.on('error', (error: any) => {
      file.close();
      if (error?.code === 'ECONNRESET') {
        options.log(`-- download failed, server closed connection`);
        promise.reject(new Error(`Download failed: server closed connection. URL: ${options.url}`));
      } else {
        options.log(`-- download failed, unexpected error`);
        promise.reject(new Error(`Download failed: ${error?.message ?? error}. URL: ${options.url}`));
      }
    });
  }, (error: any) => promise.reject(error));
  return promise;

  function onData(chunk: string) {
    downloadedBytes += chunk.length;
    options.progress(downloadedBytes, totalBytes);
  }
}

export async function downloadBrowser(options: DownloadParams) {
  await downloadFile(options);
  options.log(`SUCCESS downloading ${options.title}`);
  options.log(`extracting archive`);
  await extract(options.zipPath, { dir: options.browserDirectory });
  if (options.executablePath) {
    options.log(`fixing permissions at ${options.executablePath}`);
    await fs.promises.chmod(options.executablePath, 0o755);
  }
  await fs.promises.writeFile(browserDirectoryToMarkerFilePath(options.browserDirectory), '');
}
