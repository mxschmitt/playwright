/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type { Expect, SyncExpectationResult } from './types';
export type { Tester, TesterContext } from '@jest/expect-utils';
export { AsymmetricMatcher } from './asymmetricMatchers';
export type { AsyncExpectationResult, AsymmetricMatchers, BaseExpect, Expect, ExpectationResult, MatcherContext, MatcherFunction, MatcherFunctionWithContext, MatcherState, MatcherUtils, Matchers, SyncExpectationResult, } from './types';
export declare class JestAssertionError extends Error {
    matcherResult?: Omit<SyncExpectationResult, 'message'> & {
        message: string;
    };
}
export declare const expect: Expect;
export default expect;
