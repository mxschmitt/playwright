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
const { workspace } = require('../workspace');
const fs = require('fs');
const path = require('path');

const rmSync = dir => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 });

for (const pkg of workspace.packages()) {
  rmSync(path.join(pkg.path, 'node_modules'));
  rmSync(path.join(pkg.path, 'lib'));
  rmSync(path.join(pkg.path, 'src', 'generated'));
  const bundles = path.join(pkg.path, 'bundles');
  if (fs.existsSync(bundles) && fs.statSync(bundles).isDirectory()) {
    for (const bundle of fs.readdirSync(bundles))
      rmSync(path.join(bundles, bundle, 'node_modules'));
  }
}
