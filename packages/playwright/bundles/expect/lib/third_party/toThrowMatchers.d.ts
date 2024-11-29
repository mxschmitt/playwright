/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type { MatcherFunction, MatchersObject } from './types';
export declare const createMatcher: (matcherName: string, fromPromise?: boolean) => MatcherFunction<[any]>;
declare const matchers: MatchersObject;
export default matchers;
