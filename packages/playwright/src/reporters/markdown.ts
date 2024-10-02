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
    const lines: string[] = [
      `<tr>`,
      `<td><a href="%%--bot-merge-workflow-url--%%">%%--bot-name--%%</a></td>`,
    ];
    const totalErrors = summary.failuresToPrint.length + summary.fatalErrors.length
    if (totalErrors > 0) {
      lines.push(`<td><details><summary>${totalErrors} Tests</summary><ul>`);
      if (summary.fatalErrors.length)
        lines.push(`${summary.fatalErrors.length} fatal errors, not part of any test.<br>`);
      this._printTestList(summary.failuresToPrint, lines);

      lines.push(`</ul></details></td>`);
    }
    lines.push(`<td>${summary.flaky.length}</td>`);
    lines.push(`<td>${summary.expected}</td>`);
    lines.push(`<td><a href="%%-html-report-url-%%">Open</a></td>`);
    lines.push(`</tr>`);

    const reportFile = resolveReporterOutputPath('report.md', this._options.configDir, this._options.outputFile);
    await fs.promises.mkdir(path.dirname(reportFile), { recursive: true });
    await fs.promises.writeFile(reportFile, lines.join(''));
  }

  private _printTestList(tests: TestCase[], lines: string[]) {
    const maxTestsToShow = 10;
    const testsToShow = tests.slice(0, maxTestsToShow);
    for (const test of testsToShow)
      lines.push(`<li>${formatTestTitle(this.config, test)}</li>`);
    if (tests.length > maxTestsToShow)
      lines.push(`<li>...</li>`);
    lines.push(``);
  }
}

export default MarkdownReporter;
