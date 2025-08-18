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
// @ts-check
/* eslint-disable no-restricted-properties */
/* eslint-disable no-console */
import fs from 'fs';
import { spawn } from 'child_process';

(async () => {
  const childEnv = process.env;

  const [executable, ...args] = process.argv.slice(2);

  if (!(await fs.promises.stat(executable)).isFile())
    throw new Error(`Executable does not exist. Did you update Playwright recently? Make sure to run npx playwright install webkit-wsl`);

  // Channel ids. We currently only use TRANSPORT.
  const CHANNEL = {
    TRANSPORT: 1,
  } as const;

  // Helper to build a framed buffer: [channel (1)][length (4, BE)][payload]
  function frame(channel: number, payload: Buffer): Buffer {
    const header = Buffer.allocUnsafe(5);
    header[0] = channel & 0xFF;
    header.writeUInt32BE(payload.length, 1);
    return Buffer.concat([header, payload]);
  }

  const child = spawn(executable, args, {
    stdio: ['inherit', 'inherit', 'inherit', 'pipe', 'pipe'],
    env: childEnv,
  });

  const [readPipe, writePipe] = [child.stdio[4] as NodeJS.ReadableStream, child.stdio[3] as NodeJS.WritableStream];

  // Parser state for stdin -> child writePipe
  let rxBuffer = Buffer.alloc(0);
  process.stdin.resume();
  process.stdin.on('data', data => {
    rxBuffer = Buffer.concat([rxBuffer, data]);
    while (rxBuffer.length >= 5) {
      const channel = rxBuffer[0];
      const length = rxBuffer.readUInt32BE(1);
      if (rxBuffer.length < 5 + length)
        break;
      const payload = rxBuffer.subarray(5, 5 + length);
      rxBuffer = rxBuffer.subarray(5 + length);
      if (channel === CHANNEL.TRANSPORT) {
        if (!writePipe.write(payload))
          process.stdin.pause();
      } else {
        // Ignore unknown channels for now.
      }
    }
  });
  writePipe.on('drain', () => process.stdin.resume());
  process.stdin.on('end', () => writePipe.end());

  // child readPipe -> stdout (framed)
  readPipe.on('data', chunk => {
    const packet = frame(CHANNEL.TRANSPORT, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
    if (!process.stdout.write(packet))
      readPipe.pause();
  });
  process.stdout.on('drain', () => readPipe.resume());
  readPipe.on('end', () => process.stdout.end());
  child.on('exit', exitCode => {
    process.exit(exitCode || 0);
  });

  await new Promise((resolve, reject) => {
    child.on('exit', resolve);
    child.on('error', reject);
  });
})().catch(error => {
  console.error('Error occurred:', error);
  process.exit(1);
});
