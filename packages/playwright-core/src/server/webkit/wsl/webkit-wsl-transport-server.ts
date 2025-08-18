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
/* eslint-disable no-restricted-properties */
/* eslint-disable no-console */
import net from 'net';
import { spawn } from 'child_process';

// Bridge between parent (fd3/fd4) and the WSL child process by multiplexing over
// stdin/stdout. We frame data as: [channel:1][length:4-be][payload].
// The channel of interest (transport) is always identified at the start of each
// framed chunk that is sent over the wire.

(async () => {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    console.error('Usage: node webkit-wsl-host-wrapper.mjs <executable> [args...]');
    process.exit(1);
  }

  const parentIn  = new net.Socket({ fd: 3, readable: true,  writable: false }); // parent -> us
  const parentOut = new net.Socket({ fd: 4, readable: false, writable: true  }); // us -> parent

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

  // Parser state for child stdout -> parentOut
  let rxBuffer = Buffer.alloc(0);

  // Spawn child process with piped stdio for framing over stdin/stdout.
  const env = { ...process.env };

  let shuttingDown = false;

  const child = spawn('wsl.exe', [
    '-d',
    'playwright',
    '--cd',
    '/home/pwuser',
    '/home/pwuser/node/bin/node',
    '/home/pwuser/webkit-wsl-transport-client.js',
    process.env.WEBKIT_EXECUTABLE || '',
    ...argv,
  ], {
    env,
    // We communicate with WSL-side client via stdin/stdout pipes.
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  log('Spawned child pid', child.pid);

  const childStdin = child.stdin!;
  const childStdout = child.stdout!;

  // Wire parentIn (fd3) -> child stdin (framed)
  parentIn.on('data', chunk => {
    const packet = frame(CHANNEL.TRANSPORT, chunk);
    if (!childStdin.write(packet))
      parentIn.pause();
  });
  childStdin.on('drain', () => parentIn.resume());
  parentIn.on('close', () => childStdin.end());

  // Wire child stdout (framed) -> parentOut (fd4)
  childStdout.on('data', data => {
    rxBuffer = Buffer.concat([rxBuffer, data]);
    // Parse as many frames as available.
    while (rxBuffer.length >= 5) {
      const channel = rxBuffer[0];
      const length = rxBuffer.readUInt32BE(1);
      if (rxBuffer.length < 5 + length)
        break; // wait for more data
      const payload = rxBuffer.subarray(5, 5 + length);
      rxBuffer = rxBuffer.subarray(5 + length);
      if (channel === CHANNEL.TRANSPORT) {
        if (!parentOut.write(payload)) {
          // Backpressure: pause reading from child until drained.
          childStdout.pause();
          parentOut.once('drain', () => childStdout.resume());
        }
      } else {
        // Unknown channel, ignore for now.
      }
    }
  });
  childStdout.on('end', () => parentOut.end());

  child.on('close', (code, signal) => {
    log('Child exit', { code, signal });
    shutdown(code ?? (signal ? 0 : 0));
  });
  child.on('error', err => {
    console.error('Child process failed to start:', err);
    shutdown(1);
  });

  await new Promise(resolve => child.once('close', resolve));

  async function shutdown(code = 0) {
    if (shuttingDown)
      return;
    shuttingDown = true;

    parentIn.destroy();
    parentOut.destroy();
    childStdin.destroy();
    childStdout.destroy();
  }

  function log(...args: any[]) {
    console.error(new Date(), '[webkit-wsl-transport-server]', ...args);
  }
})().catch(error => {
  console.error('Error occurred:', error);
  process.exit(1);
});
