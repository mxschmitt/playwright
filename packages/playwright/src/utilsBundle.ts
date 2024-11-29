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

export const json5: typeof import('json5/lib') = require('./utilsBundleImpl').json5;
export const pirates: typeof import('pirates') = require('./utilsBundleImpl').pirates;
export const sourceMapSupport: typeof import('source-map-support') = require('./utilsBundleImpl').sourceMapSupport;
export const stoppable: typeof import('stoppable') = require('./utilsBundleImpl').stoppable;
export const enquirer: typeof import('enquirer') = require('./utilsBundleImpl').enquirer;
export const chokidar: typeof import('chokidar') = require('./utilsBundleImpl').chokidar;
export const getEastAsianWidth: typeof import('get-east-asian-width') = require('./utilsBundleImpl').getEastAsianWidth;
export type { RawSourceMap } from 'source-map';
