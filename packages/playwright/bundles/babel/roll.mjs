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
/* eslint-disable no-console */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

if (!import.meta.dirname)
  throw new Error('import.meta.dirname is not defined, needs more recent Node.js!');

const browser = await chromium.launch();
const page = await browser.newPage();
const packageJSON = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'package.json')));
for (const dep of Object.keys(packageJSON.dependencies)) {
  await page.waitForTimeout(3000);
  console.log('Processing ', dep);
  await page.goto(`https://www.npmjs.com/package/${dep}`);
  const title = await page.getByText('Public').locator('..').textContent();
  if (!title.startsWith(dep))
    throw new Error('Malformed title: ', title);
  const i = title.indexOf(' • Public');
  if (i === -1)
    throw new Error('Malformed title: ' + title);
  const version = title.slice(dep.length, i);
  console.log(version);
  packageJSON.dependencies[dep] = '^' + version;
}
await browser.close();
console.log(JSON.stringify(packageJSON, null, 2));
