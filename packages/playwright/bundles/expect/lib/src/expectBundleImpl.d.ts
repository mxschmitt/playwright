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
export declare const expect: import("../third_party/types").Expect;
export * as mock from 'jest-mock';
export declare const asymmetricMatchers: {
    any: (expectedObject: unknown) => {
        asymmetricMatch(other: unknown): boolean;
        toString(): string;
        getExpectedType(): string;
        toAsymmetricMatcher(): string;
        $$typeof: symbol;
        sample: any;
        inverse: boolean;
        getMatcherContext(): import("../third_party/types").MatcherContext;
    };
    anything: () => {
        asymmetricMatch(other: unknown): other is {};
        toString(): string;
        toAsymmetricMatcher(): string;
        $$typeof: symbol;
        sample: void;
        inverse: boolean;
        getMatcherContext(): import("../third_party/types").MatcherContext;
        getExpectedType?(): string;
    };
    arrayContaining: (sample: Array<unknown>) => {
        asymmetricMatch(other: unknown): boolean;
        toString(): string;
        getExpectedType(): string;
        $$typeof: symbol;
        sample: unknown[];
        inverse: boolean;
        getMatcherContext(): import("../third_party/types").MatcherContext;
        toAsymmetricMatcher?(): string;
    };
    arrayNotContaining: (sample: Array<unknown>) => {
        asymmetricMatch(other: unknown): boolean;
        toString(): string;
        getExpectedType(): string;
        $$typeof: symbol;
        sample: unknown[];
        inverse: boolean;
        getMatcherContext(): import("../third_party/types").MatcherContext;
        toAsymmetricMatcher?(): string;
    };
    closeTo: (expected: number, precision?: number) => {
        readonly precision: number;
        asymmetricMatch(other: unknown): boolean;
        toString(): string;
        getExpectedType(): string;
        toAsymmetricMatcher(): string;
        $$typeof: symbol;
        sample: number;
        inverse: boolean;
        getMatcherContext(): import("../third_party/types").MatcherContext;
    };
    notCloseTo: (expected: number, precision?: number) => {
        readonly precision: number;
        asymmetricMatch(other: unknown): boolean;
        toString(): string;
        getExpectedType(): string;
        toAsymmetricMatcher(): string;
        $$typeof: symbol;
        sample: number;
        inverse: boolean;
        getMatcherContext(): import("../third_party/types").MatcherContext;
    };
    objectContaining: (sample: Record<string, unknown>) => {
        asymmetricMatch(other: any): boolean;
        toString(): string;
        getExpectedType(): string;
        $$typeof: symbol;
        sample: Record<string | symbol, unknown>;
        inverse: boolean;
        getMatcherContext(): import("../third_party/types").MatcherContext;
        toAsymmetricMatcher?(): string;
    };
    objectNotContaining: (sample: Record<string, unknown>) => {
        asymmetricMatch(other: any): boolean;
        toString(): string;
        getExpectedType(): string;
        $$typeof: symbol;
        sample: Record<string | symbol, unknown>;
        inverse: boolean;
        getMatcherContext(): import("../third_party/types").MatcherContext;
        toAsymmetricMatcher?(): string;
    };
    stringContaining: (expected: string) => {
        asymmetricMatch(other: unknown): boolean;
        toString(): string;
        getExpectedType(): string;
        $$typeof: symbol;
        sample: string;
        inverse: boolean;
        getMatcherContext(): import("../third_party/types").MatcherContext;
        toAsymmetricMatcher?(): string;
    };
    stringMatching: (expected: string | RegExp) => {
        asymmetricMatch(other: unknown): boolean;
        toString(): string;
        getExpectedType(): string;
        $$typeof: symbol;
        sample: RegExp;
        inverse: boolean;
        getMatcherContext(): import("../third_party/types").MatcherContext;
        toAsymmetricMatcher?(): string;
    };
    stringNotContaining: (expected: string) => {
        asymmetricMatch(other: unknown): boolean;
        toString(): string;
        getExpectedType(): string;
        $$typeof: symbol;
        sample: string;
        inverse: boolean;
        getMatcherContext(): import("../third_party/types").MatcherContext;
        toAsymmetricMatcher?(): string;
    };
    stringNotMatching: (expected: string | RegExp) => {
        asymmetricMatch(other: unknown): boolean;
        toString(): string;
        getExpectedType(): string;
        $$typeof: symbol;
        sample: RegExp;
        inverse: boolean;
        getMatcherContext(): import("../third_party/types").MatcherContext;
        toAsymmetricMatcher?(): string;
    };
};
export declare const matcherUtils: {
    stringify: (object: unknown, maxDepth?: number, maxWidth?: number) => string;
};
export { EXPECTED_COLOR, INVERTED_COLOR, RECEIVED_COLOR, printReceived, } from 'jest-matcher-utils';
