"use strict";
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
const jest_matcher_utils_1 = require("jest-matcher-utils");
const jestMatchersObject_1 = require("./jestMatchersObject");
const resetAssertionsLocalState = () => {
    (0, jestMatchersObject_1.setState)({
        assertionCalls: 0,
        expectedAssertionsNumber: null,
        isExpectingAssertions: false,
        numPassingAsserts: 0,
    });
};
// Create and format all errors related to the mismatched number of `expect`
// calls and reset the matcher's state.
const extractExpectedAssertionsErrors = () => {
    const result = [];
    const { assertionCalls, expectedAssertionsNumber, expectedAssertionsNumberError, isExpectingAssertions, isExpectingAssertionsError, } = (0, jestMatchersObject_1.getState)();
    resetAssertionsLocalState();
    if (typeof expectedAssertionsNumber === 'number' &&
        assertionCalls !== expectedAssertionsNumber) {
        const numOfAssertionsExpected = (0, jest_matcher_utils_1.EXPECTED_COLOR)((0, jest_matcher_utils_1.pluralize)('assertion', expectedAssertionsNumber));
        expectedAssertionsNumberError.message =
            `${(0, jest_matcher_utils_1.matcherHint)('.assertions', '', expectedAssertionsNumber.toString(), {
                isDirectExpectCall: true,
            })}\n\n` +
                `Expected ${numOfAssertionsExpected} to be called but received ${(0, jest_matcher_utils_1.RECEIVED_COLOR)((0, jest_matcher_utils_1.pluralize)('assertion call', assertionCalls || 0))}.`;
        result.push({
            actual: assertionCalls.toString(),
            error: expectedAssertionsNumberError,
            expected: expectedAssertionsNumber.toString(),
        });
    }
    if (isExpectingAssertions && assertionCalls === 0) {
        const expected = (0, jest_matcher_utils_1.EXPECTED_COLOR)('at least one assertion');
        const received = (0, jest_matcher_utils_1.RECEIVED_COLOR)('received none');
        isExpectingAssertionsError.message = `${(0, jest_matcher_utils_1.matcherHint)('.hasAssertions', '', '', { isDirectExpectCall: true })}\n\nExpected ${expected} to be called but ${received}.`;
        result.push({
            actual: 'none',
            error: isExpectingAssertionsError,
            expected: 'at least one',
        });
    }
    return result;
};
exports.default = extractExpectedAssertionsErrors;
