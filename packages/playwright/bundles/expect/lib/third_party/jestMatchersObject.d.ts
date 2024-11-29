/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type { Tester } from '@jest/expect-utils';
import type { Expect, MatcherState, MatchersObject } from './types';
export declare const INTERNAL_MATCHER_FLAG: unique symbol;
export declare const getState: <State extends MatcherState = MatcherState>() => State;
export declare const setState: <State extends MatcherState = MatcherState>(state: Partial<State>) => void;
export declare const getMatchers: () => MatchersObject;
export declare const setMatchers: (matchers: MatchersObject, isInternal: boolean, expect: Expect) => void;
export declare const getCustomEqualityTesters: () => Array<Tester>;
export declare const addCustomEqualityTesters: (newTesters: Array<Tester>) => void;
