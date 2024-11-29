"use strict";
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable eqeqeq */
const expect_utils_1 = require("@jest/expect-utils");
const jest_get_type_1 = require("jest-get-type");
const jest_matcher_utils_1 = require("jest-matcher-utils");
const print_1 = require("./print");
// Omit colon and one or more spaces, so can call getLabelPrinter.
const EXPECTED_LABEL = 'Expected';
const RECEIVED_LABEL = 'Received';
const EXPECTED_VALUE_LABEL = 'Expected value';
const RECEIVED_VALUE_LABEL = 'Received value';
// The optional property of matcher context is true if undefined.
const isExpand = (expand) => expand !== false;
const toStrictEqualTesters = [
    expect_utils_1.iterableEquality,
    expect_utils_1.typeEquality,
    expect_utils_1.sparseArrayEquality,
    expect_utils_1.arrayBufferEquality,
];
const matchers = {
    toBe(received, expected) {
        const matcherName = 'toBe';
        const options = {
            comment: 'Object.is equality',
            isNot: this.isNot,
            promise: this.promise,
        };
        const pass = Object.is(received, expected);
        const message = pass
            ? () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                '\n\n' +
                `Expected: not ${(0, jest_matcher_utils_1.printExpected)(expected)}`
            : () => {
                const expectedType = (0, jest_get_type_1.getType)(expected);
                let deepEqualityName = null;
                if (expectedType !== 'map' && expectedType !== 'set') {
                    // If deep equality passes when referential identity fails,
                    // but exclude map and set until review of their equality logic.
                    if ((0, expect_utils_1.equals)(received, expected, [...this.customTesters, ...toStrictEqualTesters], true))
                        deepEqualityName = 'toStrictEqual';
                    else if ((0, expect_utils_1.equals)(received, expected, [
                        ...this.customTesters,
                        expect_utils_1.iterableEquality,
                    ]))
                        deepEqualityName = 'toEqual';
                }
                return ((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                    '\n\n' +
                    (deepEqualityName !== null
                        ? `${(0, jest_matcher_utils_1.DIM_COLOR)(`If it should pass with deep equality, replace "${matcherName}" with "${deepEqualityName}"`)}\n\n`
                        : '') +
                    (0, jest_matcher_utils_1.printDiffOrStringify)(expected, received, EXPECTED_LABEL, RECEIVED_LABEL, isExpand(this.expand)));
            };
        // Passing the actual and expected objects so that a custom reporter
        // could access them, for example in order to display a custom visual diff,
        // or create a different error message
        return { actual: received, expected, message, name: matcherName, pass };
    },
    toBeCloseTo(received, expected, precision = 2) {
        const matcherName = 'toBeCloseTo';
        const secondArgument = arguments.length === 3 ? 'precision' : undefined;
        const isNot = this.isNot;
        const options = {
            isNot,
            promise: this.promise,
            secondArgument,
            secondArgumentColor: (arg) => arg,
        };
        if (typeof expected !== 'number') {
            throw new Error((0, jest_matcher_utils_1.matcherErrorMessage)((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options), `${(0, jest_matcher_utils_1.EXPECTED_COLOR)('expected')} value must be a number`, (0, jest_matcher_utils_1.printWithType)('Expected', expected, jest_matcher_utils_1.printExpected)));
        }
        if (typeof received !== 'number') {
            throw new Error((0, jest_matcher_utils_1.matcherErrorMessage)((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options), `${(0, jest_matcher_utils_1.RECEIVED_COLOR)('received')} value must be a number`, (0, jest_matcher_utils_1.printWithType)('Received', received, jest_matcher_utils_1.printReceived)));
        }
        let pass = false;
        let expectedDiff = 0;
        let receivedDiff = 0;
        if (received === Infinity && expected === Infinity) {
            pass = true; // Infinity - Infinity is NaN
        }
        else if (received === -Infinity && expected === -Infinity) {
            pass = true; // -Infinity - -Infinity is NaN
        }
        else {
            expectedDiff = Math.pow(10, -precision) / 2;
            receivedDiff = Math.abs(expected - received);
            pass = receivedDiff < expectedDiff;
        }
        const message = pass
            ? () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                '\n\n' +
                `Expected: not ${(0, jest_matcher_utils_1.printExpected)(expected)}\n` +
                (receivedDiff === 0
                    ? ''
                    : `Received:     ${(0, jest_matcher_utils_1.printReceived)(received)}\n` +
                        `\n${(0, print_1.printCloseTo)(receivedDiff, expectedDiff, precision, isNot)}`)
            : () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                '\n\n' +
                `Expected: ${(0, jest_matcher_utils_1.printExpected)(expected)}\n` +
                `Received: ${(0, jest_matcher_utils_1.printReceived)(received)}\n` +
                '\n' +
                (0, print_1.printCloseTo)(receivedDiff, expectedDiff, precision, isNot);
        return { message, pass };
    },
    toBeDefined(received, expected) {
        const matcherName = 'toBeDefined';
        const options = {
            isNot: this.isNot,
            promise: this.promise,
        };
        (0, jest_matcher_utils_1.ensureNoExpected)(expected, matcherName, options);
        const pass = received !== void 0;
        const message = () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, '', options) +
            '\n\n' +
            `Received: ${(0, jest_matcher_utils_1.printReceived)(received)}`;
        return { message, pass };
    },
    toBeFalsy(received, expected) {
        const matcherName = 'toBeFalsy';
        const options = {
            isNot: this.isNot,
            promise: this.promise,
        };
        (0, jest_matcher_utils_1.ensureNoExpected)(expected, matcherName, options);
        const pass = !received;
        const message = () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, '', options) +
            '\n\n' +
            `Received: ${(0, jest_matcher_utils_1.printReceived)(received)}`;
        return { message, pass };
    },
    toBeGreaterThan(received, expected) {
        const matcherName = 'toBeGreaterThan';
        const isNot = this.isNot;
        const options = {
            isNot,
            promise: this.promise,
        };
        (0, jest_matcher_utils_1.ensureNumbers)(received, expected, matcherName, options);
        const pass = received > expected;
        const message = () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
            '\n\n' +
            `Expected:${isNot ? ' not' : ''} > ${(0, jest_matcher_utils_1.printExpected)(expected)}\n` +
            `Received:${isNot ? '    ' : ''}   ${(0, jest_matcher_utils_1.printReceived)(received)}`;
        return { message, pass };
    },
    toBeGreaterThanOrEqual(received, expected) {
        const matcherName = 'toBeGreaterThanOrEqual';
        const isNot = this.isNot;
        const options = {
            isNot,
            promise: this.promise,
        };
        (0, jest_matcher_utils_1.ensureNumbers)(received, expected, matcherName, options);
        const pass = received >= expected;
        const message = () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
            '\n\n' +
            `Expected:${isNot ? ' not' : ''} >= ${(0, jest_matcher_utils_1.printExpected)(expected)}\n` +
            `Received:${isNot ? '    ' : ''}    ${(0, jest_matcher_utils_1.printReceived)(received)}`;
        return { message, pass };
    },
    toBeInstanceOf(received, expected) {
        const matcherName = 'toBeInstanceOf';
        const options = {
            isNot: this.isNot,
            promise: this.promise,
        };
        if (typeof expected !== 'function') {
            throw new Error((0, jest_matcher_utils_1.matcherErrorMessage)((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options), `${(0, jest_matcher_utils_1.EXPECTED_COLOR)('expected')} value must be a function`, (0, jest_matcher_utils_1.printWithType)('Expected', expected, jest_matcher_utils_1.printExpected)));
        }
        const pass = received instanceof expected;
        const message = pass
            ? () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                '\n\n' +
                (0, print_1.printExpectedConstructorNameNot)('Expected constructor', expected) +
                (typeof received.constructor === 'function' &&
                    received.constructor !== expected
                    ? (0, print_1.printReceivedConstructorNameNot)('Received constructor', received.constructor, expected)
                    : '')
            : () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                '\n\n' +
                (0, print_1.printExpectedConstructorName)('Expected constructor', expected) +
                ((0, jest_get_type_1.isPrimitive)(received) || Object.getPrototypeOf(received) === null
                    ? `\nReceived value has no prototype\nReceived value: ${(0, jest_matcher_utils_1.printReceived)(received)}`
                    : typeof received.constructor !== 'function'
                        ? `\nReceived value: ${(0, jest_matcher_utils_1.printReceived)(received)}`
                        : (0, print_1.printReceivedConstructorName)('Received constructor', received.constructor));
        return { message, pass };
    },
    toBeLessThan(received, expected) {
        const matcherName = 'toBeLessThan';
        const isNot = this.isNot;
        const options = {
            isNot,
            promise: this.promise,
        };
        (0, jest_matcher_utils_1.ensureNumbers)(received, expected, matcherName, options);
        const pass = received < expected;
        const message = () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
            '\n\n' +
            `Expected:${isNot ? ' not' : ''} < ${(0, jest_matcher_utils_1.printExpected)(expected)}\n` +
            `Received:${isNot ? '    ' : ''}   ${(0, jest_matcher_utils_1.printReceived)(received)}`;
        return { message, pass };
    },
    toBeLessThanOrEqual(received, expected) {
        const matcherName = 'toBeLessThanOrEqual';
        const isNot = this.isNot;
        const options = {
            isNot,
            promise: this.promise,
        };
        (0, jest_matcher_utils_1.ensureNumbers)(received, expected, matcherName, options);
        const pass = received <= expected;
        const message = () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
            '\n\n' +
            `Expected:${isNot ? ' not' : ''} <= ${(0, jest_matcher_utils_1.printExpected)(expected)}\n` +
            `Received:${isNot ? '    ' : ''}    ${(0, jest_matcher_utils_1.printReceived)(received)}`;
        return { message, pass };
    },
    toBeNaN(received, expected) {
        const matcherName = 'toBeNaN';
        const options = {
            isNot: this.isNot,
            promise: this.promise,
        };
        (0, jest_matcher_utils_1.ensureNoExpected)(expected, matcherName, options);
        const pass = Number.isNaN(received);
        const message = () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, '', options) +
            '\n\n' +
            `Received: ${(0, jest_matcher_utils_1.printReceived)(received)}`;
        return { message, pass };
    },
    toBeNull(received, expected) {
        const matcherName = 'toBeNull';
        const options = {
            isNot: this.isNot,
            promise: this.promise,
        };
        (0, jest_matcher_utils_1.ensureNoExpected)(expected, matcherName, options);
        const pass = received === null;
        const message = () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, '', options) +
            '\n\n' +
            `Received: ${(0, jest_matcher_utils_1.printReceived)(received)}`;
        return { message, pass };
    },
    toBeTruthy(received, expected) {
        const matcherName = 'toBeTruthy';
        const options = {
            isNot: this.isNot,
            promise: this.promise,
        };
        (0, jest_matcher_utils_1.ensureNoExpected)(expected, matcherName, options);
        const pass = !!received;
        const message = () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, '', options) +
            '\n\n' +
            `Received: ${(0, jest_matcher_utils_1.printReceived)(received)}`;
        return { message, pass };
    },
    toBeUndefined(received, expected) {
        const matcherName = 'toBeUndefined';
        const options = {
            isNot: this.isNot,
            promise: this.promise,
        };
        (0, jest_matcher_utils_1.ensureNoExpected)(expected, matcherName, options);
        const pass = received === void 0;
        const message = () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, '', options) +
            '\n\n' +
            `Received: ${(0, jest_matcher_utils_1.printReceived)(received)}`;
        return { message, pass };
    },
    toContain(received, expected) {
        const matcherName = 'toContain';
        const isNot = this.isNot;
        const options = {
            comment: 'indexOf',
            isNot,
            promise: this.promise,
        };
        if (received == null) {
            throw new Error((0, jest_matcher_utils_1.matcherErrorMessage)((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options), `${(0, jest_matcher_utils_1.RECEIVED_COLOR)('received')} value must not be null nor undefined`, (0, jest_matcher_utils_1.printWithType)('Received', received, jest_matcher_utils_1.printReceived)));
        }
        if (typeof received === 'string') {
            const wrongTypeErrorMessage = `${(0, jest_matcher_utils_1.EXPECTED_COLOR)('expected')} value must be a string if ${(0, jest_matcher_utils_1.RECEIVED_COLOR)('received')} value is a string`;
            if (typeof expected !== 'string') {
                throw new Error((0, jest_matcher_utils_1.matcherErrorMessage)((0, jest_matcher_utils_1.matcherHint)(matcherName, received, String(expected), options), wrongTypeErrorMessage, (0, jest_matcher_utils_1.printWithType)('Expected', expected, jest_matcher_utils_1.printExpected) +
                    '\n' +
                    (0, jest_matcher_utils_1.printWithType)('Received', received, jest_matcher_utils_1.printReceived)));
            }
            const index = received.indexOf(String(expected));
            const pass = index !== -1;
            const message = () => {
                const labelExpected = `Expected ${typeof expected === 'string' ? 'substring' : 'value'}`;
                const labelReceived = 'Received string';
                const printLabel = (0, jest_matcher_utils_1.getLabelPrinter)(labelExpected, labelReceived);
                return ((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                    '\n\n' +
                    `${printLabel(labelExpected)}${isNot ? 'not ' : ''}${(0, jest_matcher_utils_1.printExpected)(expected)}\n` +
                    `${printLabel(labelReceived)}${isNot ? '    ' : ''}${isNot
                        ? (0, print_1.printReceivedStringContainExpectedSubstring)(received, index, String(expected).length)
                        : (0, jest_matcher_utils_1.printReceived)(received)}`);
            };
            return { message, pass };
        }
        const indexable = Array.from(received);
        const index = indexable.indexOf(expected);
        const pass = index !== -1;
        const message = () => {
            const labelExpected = 'Expected value';
            const labelReceived = `Received ${(0, jest_get_type_1.getType)(received)}`;
            const printLabel = (0, jest_matcher_utils_1.getLabelPrinter)(labelExpected, labelReceived);
            return ((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                '\n\n' +
                `${printLabel(labelExpected)}${isNot ? 'not ' : ''}${(0, jest_matcher_utils_1.printExpected)(expected)}\n` +
                `${printLabel(labelReceived)}${isNot ? '    ' : ''}${isNot && Array.isArray(received)
                    ? (0, print_1.printReceivedArrayContainExpectedItem)(received, index)
                    : (0, jest_matcher_utils_1.printReceived)(received)}` +
                (!isNot &&
                    indexable.findIndex(item => (0, expect_utils_1.equals)(item, expected, [...this.customTesters, expect_utils_1.iterableEquality])) !== -1
                    ? `\n\n${jest_matcher_utils_1.SUGGEST_TO_CONTAIN_EQUAL}`
                    : ''));
        };
        return { message, pass };
    },
    toContainEqual(received, expected) {
        const matcherName = 'toContainEqual';
        const isNot = this.isNot;
        const options = {
            comment: 'deep equality',
            isNot,
            promise: this.promise,
        };
        if (received == null) {
            throw new Error((0, jest_matcher_utils_1.matcherErrorMessage)((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options), `${(0, jest_matcher_utils_1.RECEIVED_COLOR)('received')} value must not be null nor undefined`, (0, jest_matcher_utils_1.printWithType)('Received', received, jest_matcher_utils_1.printReceived)));
        }
        const index = Array.from(received).findIndex(item => (0, expect_utils_1.equals)(item, expected, [...this.customTesters, expect_utils_1.iterableEquality]));
        const pass = index !== -1;
        const message = () => {
            const labelExpected = 'Expected value';
            const labelReceived = `Received ${(0, jest_get_type_1.getType)(received)}`;
            const printLabel = (0, jest_matcher_utils_1.getLabelPrinter)(labelExpected, labelReceived);
            return ((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                '\n\n' +
                `${printLabel(labelExpected)}${isNot ? 'not ' : ''}${(0, jest_matcher_utils_1.printExpected)(expected)}\n` +
                `${printLabel(labelReceived)}${isNot ? '    ' : ''}${isNot && Array.isArray(received)
                    ? (0, print_1.printReceivedArrayContainExpectedItem)(received, index)
                    : (0, jest_matcher_utils_1.printReceived)(received)}`);
        };
        return { message, pass };
    },
    toEqual(received, expected) {
        const matcherName = 'toEqual';
        const options = {
            comment: 'deep equality',
            isNot: this.isNot,
            promise: this.promise,
        };
        const pass = (0, expect_utils_1.equals)(received, expected, [
            ...this.customTesters,
            expect_utils_1.iterableEquality,
        ]);
        const message = pass
            ? () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                '\n\n' +
                `Expected: not ${(0, jest_matcher_utils_1.printExpected)(expected)}\n` +
                ((0, jest_matcher_utils_1.stringify)(expected) !== (0, jest_matcher_utils_1.stringify)(received)
                    ? `Received:     ${(0, jest_matcher_utils_1.printReceived)(received)}`
                    : '')
            : () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                '\n\n' +
                (0, jest_matcher_utils_1.printDiffOrStringify)(expected, received, EXPECTED_LABEL, RECEIVED_LABEL, isExpand(this.expand));
        // Passing the actual and expected objects so that a custom reporter
        // could access them, for example in order to display a custom visual diff,
        // or create a different error message
        return { actual: received, expected, message, name: matcherName, pass };
    },
    toHaveLength(received, expected) {
        const matcherName = 'toHaveLength';
        const isNot = this.isNot;
        const options = {
            isNot,
            promise: this.promise,
        };
        if (typeof (received === null || received === void 0 ? void 0 : received.length) !== 'number') {
            throw new Error((0, jest_matcher_utils_1.matcherErrorMessage)((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options), `${(0, jest_matcher_utils_1.RECEIVED_COLOR)('received')} value must have a length property whose value must be a number`, (0, jest_matcher_utils_1.printWithType)('Received', received, jest_matcher_utils_1.printReceived)));
        }
        (0, jest_matcher_utils_1.ensureExpectedIsNonNegativeInteger)(expected, matcherName, options);
        const pass = received.length === expected;
        const message = () => {
            const labelExpected = 'Expected length';
            const labelReceivedLength = 'Received length';
            const labelReceivedValue = `Received ${(0, jest_get_type_1.getType)(received)}`;
            const printLabel = (0, jest_matcher_utils_1.getLabelPrinter)(labelExpected, labelReceivedLength, labelReceivedValue);
            return ((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                '\n\n' +
                `${printLabel(labelExpected)}${isNot ? 'not ' : ''}${(0, jest_matcher_utils_1.printExpected)(expected)}\n` +
                (isNot
                    ? ''
                    : `${printLabel(labelReceivedLength)}${(0, jest_matcher_utils_1.printReceived)(received.length)}\n`) +
                `${printLabel(labelReceivedValue)}${isNot ? '    ' : ''}${(0, jest_matcher_utils_1.printReceived)(received)}`);
        };
        return { message, pass };
    },
    toHaveProperty(received, expectedPath, expectedValue) {
        const matcherName = 'toHaveProperty';
        const expectedArgument = 'path';
        const hasValue = arguments.length === 3;
        const options = {
            isNot: this.isNot,
            promise: this.promise,
            secondArgument: hasValue ? 'value' : '',
        };
        if (received === null || received === undefined) {
            throw new Error((0, jest_matcher_utils_1.matcherErrorMessage)((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, expectedArgument, options), `${(0, jest_matcher_utils_1.RECEIVED_COLOR)('received')} value must not be null nor undefined`, (0, jest_matcher_utils_1.printWithType)('Received', received, jest_matcher_utils_1.printReceived)));
        }
        const expectedPathType = (0, jest_get_type_1.getType)(expectedPath);
        if (expectedPathType !== 'string' && expectedPathType !== 'array') {
            throw new Error((0, jest_matcher_utils_1.matcherErrorMessage)((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, expectedArgument, options), `${(0, jest_matcher_utils_1.EXPECTED_COLOR)('expected')} path must be a string or array`, (0, jest_matcher_utils_1.printWithType)('Expected', expectedPath, jest_matcher_utils_1.printExpected)));
        }
        const expectedPathLength = typeof expectedPath === 'string'
            ? (0, expect_utils_1.pathAsArray)(expectedPath).length
            : expectedPath.length;
        if (expectedPathType === 'array' && expectedPathLength === 0) {
            throw new Error((0, jest_matcher_utils_1.matcherErrorMessage)((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, expectedArgument, options), `${(0, jest_matcher_utils_1.EXPECTED_COLOR)('expected')} path must not be an empty array`, (0, jest_matcher_utils_1.printWithType)('Expected', expectedPath, jest_matcher_utils_1.printExpected)));
        }
        const result = (0, expect_utils_1.getPath)(received, expectedPath);
        const { lastTraversedObject, endPropIsDefined, hasEndProp, value } = result;
        const receivedPath = result.traversedPath;
        const hasCompletePath = receivedPath.length === expectedPathLength;
        const receivedValue = hasCompletePath ? result.value : lastTraversedObject;
        const pass = hasValue && endPropIsDefined
            ? (0, expect_utils_1.equals)(value, expectedValue, [
                ...this.customTesters,
                expect_utils_1.iterableEquality,
            ])
            : Boolean(hasEndProp);
        const message = pass
            ? () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, expectedArgument, options) +
                '\n\n' +
                (hasValue
                    ? `Expected path: ${(0, jest_matcher_utils_1.printExpected)(expectedPath)}\n\n` +
                        `Expected value: not ${(0, jest_matcher_utils_1.printExpected)(expectedValue)}${(0, jest_matcher_utils_1.stringify)(expectedValue) !== (0, jest_matcher_utils_1.stringify)(receivedValue)
                            ? `\nReceived value:     ${(0, jest_matcher_utils_1.printReceived)(receivedValue)}`
                            : ''}`
                    : `Expected path: not ${(0, jest_matcher_utils_1.printExpected)(expectedPath)}\n\n` +
                        `Received value: ${(0, jest_matcher_utils_1.printReceived)(receivedValue)}`)
            : () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, expectedArgument, options) +
                '\n\n' +
                `Expected path: ${(0, jest_matcher_utils_1.printExpected)(expectedPath)}\n` +
                (hasCompletePath
                    ? `\n${(0, jest_matcher_utils_1.printDiffOrStringify)(expectedValue, receivedValue, EXPECTED_VALUE_LABEL, RECEIVED_VALUE_LABEL, isExpand(this.expand))}`
                    : `Received path: ${(0, jest_matcher_utils_1.printReceived)(expectedPathType === 'array' || receivedPath.length === 0
                        ? receivedPath
                        : receivedPath.join('.'))}\n\n${hasValue
                        ? `Expected value: ${(0, jest_matcher_utils_1.printExpected)(expectedValue)}\n`
                        : ''}Received value: ${(0, jest_matcher_utils_1.printReceived)(receivedValue)}`);
        return { message, pass };
    },
    toMatch(received, expected) {
        const matcherName = 'toMatch';
        const options = {
            isNot: this.isNot,
            promise: this.promise,
        };
        if (typeof received !== 'string') {
            throw new Error((0, jest_matcher_utils_1.matcherErrorMessage)((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options), `${(0, jest_matcher_utils_1.RECEIVED_COLOR)('received')} value must be a string`, (0, jest_matcher_utils_1.printWithType)('Received', received, jest_matcher_utils_1.printReceived)));
        }
        if (!(typeof expected === 'string') &&
            !(expected && typeof expected.test === 'function')) {
            throw new Error((0, jest_matcher_utils_1.matcherErrorMessage)((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options), `${(0, jest_matcher_utils_1.EXPECTED_COLOR)('expected')} value must be a string or regular expression`, (0, jest_matcher_utils_1.printWithType)('Expected', expected, jest_matcher_utils_1.printExpected)));
        }
        const pass = typeof expected === 'string'
            ? received.includes(expected)
            : new RegExp(expected).test(received);
        const message = pass
            ? () => typeof expected === 'string'
                ?
                    (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                        '\n\n' +
                        `Expected substring: not ${(0, jest_matcher_utils_1.printExpected)(expected)}\n` +
                        `Received string:        ${(0, print_1.printReceivedStringContainExpectedSubstring)(received, received.indexOf(expected), expected.length)}`
                :
                    (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                        '\n\n' +
                        `Expected pattern: not ${(0, jest_matcher_utils_1.printExpected)(expected)}\n` +
                        `Received string:      ${(0, print_1.printReceivedStringContainExpectedResult)(received, typeof expected.exec === 'function'
                            ? expected.exec(received)
                            : null)}`
            : () => {
                const labelExpected = `Expected ${typeof expected === 'string' ? 'substring' : 'pattern'}`;
                const labelReceived = 'Received string';
                const printLabel = (0, jest_matcher_utils_1.getLabelPrinter)(labelExpected, labelReceived);
                return ((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                    '\n\n' +
                    `${printLabel(labelExpected)}${(0, jest_matcher_utils_1.printExpected)(expected)}\n` +
                    `${printLabel(labelReceived)}${(0, jest_matcher_utils_1.printReceived)(received)}`);
            };
        return { message, pass };
    },
    toMatchObject(received, expected) {
        const matcherName = 'toMatchObject';
        const options = {
            isNot: this.isNot,
            promise: this.promise,
        };
        if (typeof received !== 'object' || received === null) {
            throw new Error((0, jest_matcher_utils_1.matcherErrorMessage)((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options), `${(0, jest_matcher_utils_1.RECEIVED_COLOR)('received')} value must be a non-null object`, (0, jest_matcher_utils_1.printWithType)('Received', received, jest_matcher_utils_1.printReceived)));
        }
        if (typeof expected !== 'object' || expected === null) {
            throw new Error((0, jest_matcher_utils_1.matcherErrorMessage)((0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options), `${(0, jest_matcher_utils_1.EXPECTED_COLOR)('expected')} value must be a non-null object`, (0, jest_matcher_utils_1.printWithType)('Expected', expected, jest_matcher_utils_1.printExpected)));
        }
        const pass = (0, expect_utils_1.equals)(received, expected, [
            ...this.customTesters,
            expect_utils_1.iterableEquality,
            expect_utils_1.subsetEquality,
        ]);
        const message = pass
            ? () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                '\n\n' +
                `Expected: not ${(0, jest_matcher_utils_1.printExpected)(expected)}` +
                ((0, jest_matcher_utils_1.stringify)(expected) !== (0, jest_matcher_utils_1.stringify)(received)
                    ? `\nReceived:     ${(0, jest_matcher_utils_1.printReceived)(received)}`
                    : '')
            : () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                '\n\n' +
                (0, jest_matcher_utils_1.printDiffOrStringify)(expected, (0, expect_utils_1.getObjectSubset)(received, expected, this.customTesters), EXPECTED_LABEL, RECEIVED_LABEL, isExpand(this.expand));
        return { message, pass };
    },
    toStrictEqual(received, expected) {
        const matcherName = 'toStrictEqual';
        const options = {
            comment: 'deep equality',
            isNot: this.isNot,
            promise: this.promise,
        };
        const pass = (0, expect_utils_1.equals)(received, expected, [...this.customTesters, ...toStrictEqualTesters], true);
        const message = pass
            ? () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                '\n\n' +
                `Expected: not ${(0, jest_matcher_utils_1.printExpected)(expected)}\n` +
                ((0, jest_matcher_utils_1.stringify)(expected) !== (0, jest_matcher_utils_1.stringify)(received)
                    ? `Received:     ${(0, jest_matcher_utils_1.printReceived)(received)}`
                    : '')
            : () => (0, jest_matcher_utils_1.matcherHint)(matcherName, undefined, undefined, options) +
                '\n\n' +
                (0, jest_matcher_utils_1.printDiffOrStringify)(expected, received, EXPECTED_LABEL, RECEIVED_LABEL, isExpand(this.expand));
        // Passing the actual and expected objects so that a custom reporter
        // could access them, for example in order to display a custom visual diff,
        // or create a different error message
        return { actual: received, expected, message, name: matcherName, pass };
    },
};
exports.default = matchers;
