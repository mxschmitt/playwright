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
import type { FullResult, TestCase } from '../../types/testReporter';
import { resolveReporterOutputPath } from '../util';
import { BaseReporter, formatTestTitle } from './base';

type MarkdownReporterOptions = {
  configDir: string,
  outputFile?: string;
};

class MarkdownReporter extends BaseReporter {
  private _options: MarkdownReporterOptions;

  constructor(options: MarkdownReporterOptions) {
    super();
    this._options = options;
  }

  printsToStdio() {
    return false;
  }

  override async onEnd(result: FullResult) {
    await super.onEnd(result);
    const summary = this.generateSummary();
    const lines: string[] = [];

    const failingTests = summary.unexpected.slice(0, 5).map(test => `<li>${formatTestTitle(this.config, test)}</li>`).join('');
    const failingSummary = summary.unexpected.length > 0
      ? `<details><summary>${summary.unexpected.length} Tests</summary><ul>${failingTests}${summary.unexpected.length > 5 ? '<li>…</li>' : ''}</ul></details>`
      : '0';

    lines.push(`| ${failingSummary} | ${summary.flaky.length} | ${summary.expected} |`);

    const reportFile = resolveReporterOutputPath('report.md', this._options.configDir, this._options.outputFile);
    await fs.promises.mkdir(path.dirname(reportFile), { recursive: true });
    await fs.promises.writeFile(reportFile, lines.join('\n'));
  }
}

export default MarkdownReporter;
