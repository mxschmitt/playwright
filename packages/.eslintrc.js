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
module.exports = {
  'extends': '../.eslintrc.js',
  /**
   * ESLint rules
   *
   * All available rules: http://eslint.org/docs/rules/
   *
   * Rules take the following form:
   *   "rule-name", [severity, { opts }]
   * Severity: 2 == error, 1 == warning, 0 == off.
   */
  'rules': {
    'no-console': 2,
    'no-debugger': 2,
    'no-restricted-properties': [2, {
      'object': 'process',
      'property': 'exit',
      'message': 'Please use gracefullyProcessExitDoNotHang function to exit the process.',
    }],
  }
};
