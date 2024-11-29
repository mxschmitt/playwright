"use strict";
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.printReceivedConstructorNameNot = exports.printReceivedConstructorName = exports.printExpectedConstructorNameNot = exports.printExpectedConstructorName = exports.printCloseTo = exports.printReceivedArrayContainExpectedItem = exports.printReceivedStringContainExpectedResult = exports.printReceivedStringContainExpectedSubstring = void 0;
const jest_matcher_utils_1 = require("jest-matcher-utils");
// Format substring but do not enclose in double quote marks.
// The replacement is compatible with pretty-format package.
const printSubstring = (val) => val.replace(/"|\\/g, '\\$&');
const printReceivedStringContainExpectedSubstring = (received, start, length) => (0, jest_matcher_utils_1.RECEIVED_COLOR)(`"${printSubstring(received.slice(0, start))}${(0, jest_matcher_utils_1.INVERTED_COLOR)(printSubstring(received.slice(start, start + length)))}${printSubstring(received.slice(start + length))}"`);
exports.printReceivedStringContainExpectedSubstring = printReceivedStringContainExpectedSubstring;
const printReceivedStringContainExpectedResult = (received, result) => result === null
    ? (0, jest_matcher_utils_1.printReceived)(received)
    : (0, exports.printReceivedStringContainExpectedSubstring)(received, result.index, result[0].length);
exports.printReceivedStringContainExpectedResult = printReceivedStringContainExpectedResult;
// The serialized array is compatible with pretty-format package min option.
// However, items have default stringify depth (instead of depth - 1)
// so expected item looks consistent by itself and enclosed in the array.
const printReceivedArrayContainExpectedItem = (received, index) => (0, jest_matcher_utils_1.RECEIVED_COLOR)(`[${received
    .map((item, i) => {
    const stringified = (0, jest_matcher_utils_1.stringify)(item);
    return i === index ? (0, jest_matcher_utils_1.INVERTED_COLOR)(stringified) : stringified;
})
    .join(', ')}]`);
exports.printReceivedArrayContainExpectedItem = printReceivedArrayContainExpectedItem;
const printCloseTo = (receivedDiff, expectedDiff, precision, isNot) => {
    const receivedDiffString = (0, jest_matcher_utils_1.stringify)(receivedDiff);
    const expectedDiffString = receivedDiffString.includes('e')
        ? // toExponential arg is number of digits after the decimal point.
            expectedDiff.toExponential(0)
        : 0 <= precision && precision < 20
            ? // toFixed arg is number of digits after the decimal point.
                // It may be a value between 0 and 20 inclusive.
                // Implementations may optionally support a larger range of values.
                expectedDiff.toFixed(precision + 1)
            : (0, jest_matcher_utils_1.stringify)(expectedDiff);
    return (`Expected precision:  ${isNot ? '    ' : ''}  ${(0, jest_matcher_utils_1.stringify)(precision)}\n` +
        `Expected difference: ${isNot ? 'not ' : ''}< ${(0, jest_matcher_utils_1.EXPECTED_COLOR)(expectedDiffString)}\n` +
        `Received difference: ${isNot ? '    ' : ''}  ${(0, jest_matcher_utils_1.RECEIVED_COLOR)(receivedDiffString)}`);
};
exports.printCloseTo = printCloseTo;
const printExpectedConstructorName = (label, expected) => `${printConstructorName(label, expected, false, true)}\n`;
exports.printExpectedConstructorName = printExpectedConstructorName;
const printExpectedConstructorNameNot = (label, expected) => `${printConstructorName(label, expected, true, true)}\n`;
exports.printExpectedConstructorNameNot = printExpectedConstructorNameNot;
const printReceivedConstructorName = (label, received) => `${printConstructorName(label, received, false, false)}\n`;
exports.printReceivedConstructorName = printReceivedConstructorName;
// Do not call function if received is equal to expected.
const printReceivedConstructorNameNot = (label, received, expected) => typeof expected.name === 'string' &&
    expected.name.length !== 0 &&
    typeof received.name === 'string' &&
    received.name.length !== 0
    ? `${printConstructorName(label, received, true, false)} ${Object.getPrototypeOf(received) === expected
        ? 'extends'
        : 'extends … extends'} ${(0, jest_matcher_utils_1.EXPECTED_COLOR)(expected.name)}\n`
    : `${printConstructorName(label, received, false, false)}\n`;
exports.printReceivedConstructorNameNot = printReceivedConstructorNameNot;
const printConstructorName = (label, constructor, isNot, isExpected) => typeof constructor.name !== 'string'
    ? `${label} name is not a string`
    : constructor.name.length === 0
        ? `${label} name is an empty string`
        : `${label}: ${!isNot ? '' : isExpected ? 'not ' : '    '}${isExpected
            ? (0, jest_matcher_utils_1.EXPECTED_COLOR)(constructor.name)
            : (0, jest_matcher_utils_1.RECEIVED_COLOR)(constructor.name)}`;
