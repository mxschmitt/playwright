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

import http from 'http';
import path from 'path';
import { test, expect } from './playwright-test-fixtures';

test('should create a server', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex + 10500;
  const result = await runInlineTest({
    'test.spec.ts': `
      const { test } = pwt;
      test('connect to the server', async ({baseURL, page}) => {
        expect(baseURL).toBe('http://localhost:${port}');
        await page.goto(baseURL + '/hello');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${path.join(__dirname, 'assets', 'simple-server.js')} ${port}',
          port: ${port},
        }
      };
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].results[0].status).toContain('passed');
});

test('should create a server with environment variables', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex + 10500;
  const result = await runInlineTest({
    'test.spec.ts': `
      const { test } = pwt;
      test('connect to the server', async ({baseURL, page}) => {
        expect(baseURL).toBe('http://localhost:${port}');
        await page.goto(baseURL + '/env-FOO');
        expect(await page.textContent('body')).toBe('BAR');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${path.join(__dirname, 'assets', 'simple-server.js')} ${port}',
          port: ${port},
          env: {
            'FOO': 'BAR',
          }
        }
      };
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].results[0].status).toContain('passed');
});

test('should time out waiting for a server', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex + 10500;
  const result = await runInlineTest({
    'test.spec.ts': `
      const { test } = pwt;
      test('connect to the server', async ({baseURL, page}) => {
        expect(baseURL).toBe('http://localhost:${port}');
        await page.goto(baseURL + '/hello');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${path.join(__dirname, 'assets', 'simple-server.js')} ${port}',
          port: ${port},
          timeout: 100,
        }
      };
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`failed to start web server on port ${port} via "node`);
});

test('should be able to detect the port from the process stdout', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex + 10500;
  const result = await runInlineTest({
    'test.spec.ts': `
      const { test } = pwt;
      test('connect to the server', async ({baseURL, page}) => {
        expect(baseURL).toBe('http://localhost:${port}');
        await page.goto(baseURL + '/hello');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${path.join(__dirname, 'assets', 'simple-server-with-stdout.js')} ${port}',
        }
      };
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain(`Listening on http://localhost:${port}`);
  expect(result.report.suites[0].specs[0].tests[0].results[0].status).toContain('passed');
});

test('should be able to specify the baseURL without the server', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex + 10500;
  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    res.end('<html><body>hello</body></html>');
  });
  await new Promise(resolve => server.listen(port, resolve));
  const result = await runInlineTest({
    'test.spec.ts': `
      const { test } = pwt;
      test('connect to the server', async ({baseURL, page}) => {
        expect(baseURL).toBe('http://localhost:${port}');
        await page.goto(baseURL + '/hello');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        use: {
          baseURL: 'http://localhost:${port}',
        }
      };
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].results[0].status).toContain('passed');
  server.close();
});

test('should be able to specify the baseURL via the environment variable', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex + 10500;
  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    res.end('<html><body>hello</body></html>');
  });
  await new Promise(resolve => server.listen(port, resolve));
  const result = await runInlineTest({
    'test.spec.ts': `
      const { test } = pwt;
      test('connect to the server', async ({baseURL, page}) => {
        expect(baseURL).toBe('http://localhost:${port}');
        await page.goto(baseURL + '/hello');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
  }, { }, {
    PLAYWRIGHT_BASE_URL: `http://localhost:${port}`,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].results[0].status).toContain('passed');
  server.close();
});

