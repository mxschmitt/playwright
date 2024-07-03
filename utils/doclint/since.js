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
const fs = require('fs');
const path = require('path');
const { ZipFile } = require('../../packages/playwright-core/lib/utils');

(async () => {
  // Extract API.json
  if (!process.env.DRIVERS_DIR) {
    console.log('DRIVERS_DIR env should contain downloaded drivers');
    process.exit(1);
  }

  for (const name of fs.readdirSync(process.env.DRIVERS_DIR)) {
    const match = name.match(/playwright-(.*).0-linux.zip/);
    if (!match)
      continue;
    const apiName = path.join(process.env.DRIVERS_DIR, `api-${match[1]}.json`);
    if (!fs.existsSync(apiName)) {
      const zipFile = new ZipFile(path.join(process.env.DRIVERS_DIR, name));
      const buffer = await zipFile.read('package/api.json');
      fs.writeFileSync(path.join(process.env.DRIVERS_DIR, `api-${match[1]}.json`), buffer);
      zipFile.close();
    }
  }

  // Build Since map.
  const since = new Map();
  for (const name of fs.readdirSync(process.env.DRIVERS_DIR)) {
    const match = name.match(/api-(.*).json/);
    if (!match)
      continue;
    const version = match[1];
    const json = JSON.parse(fs.readFileSync(path.join(process.env.DRIVERS_DIR, `api-${match[1]}.json`), 'utf-8'));
    for (const clazz of json) {
      add(since, `# class: ${clazz.name}`, version);
      for (const member of clazz.members) {
        add(since, `## ${member.async ? 'async ' : ''}${member.kind}: ${clazz.name}.${member.name}`, version);
        for (const arg of member.args) {
          if (arg.name === 'options') {
            for (const option of arg.type.properties)
              add(since, `### option: ${clazz.name}.${member.name}.${option.name}`, version);
          } else {
            add(since, `### param: ${clazz.name}.${member.name}.${arg.name}`, version);
          }
        }
      }
    }
  }

  // Patch docs
  for (const name of fs.readdirSync('docs/src/api')) {
    const lines = fs.readFileSync(path.join('docs/src/api', name), 'utf-8');
    const toPatch = new Map();
    for (const line of lines.split('\n')) {
      if (!line.startsWith('# class:') && !line.startsWith('## method:') && !line.startsWith('## async method:') && !line.startsWith('## property:') && !line.startsWith('## event:') && !line.startsWith('### param:') && !line.startsWith('### option:'))
        continue;
      const key = line.includes('=') ? line.substring(0, line.indexOf('=')).trim() : line;
      const version = since.get(key);
      console.log(key);

      if (!version) {
        console.log('Not yet released: ' + line);
        continue;
      }

      toPatch.set(line + '\n', line + `\n* since: v${version}\n`);
    }
    if (toPatch.size) {
      let newContent = lines;
      for (const [from, to] of toPatch)
        newContent = newContent.replace(new RegExp(from, 'g'), to);
      fs.writeFileSync(path.join('docs/src/api', name), newContent);
    }
  }

})();

function add(since, name, version) {
  const v = since.get(name);
  if (!v || (+v.split('.')[1]) > (+version.split('.')[1]))
    since.set(name, version);
}
