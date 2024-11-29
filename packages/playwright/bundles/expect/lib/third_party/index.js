"use strict";
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expect = exports.JestAssertionError = exports.AsymmetricMatcher = void 0;
const expect_utils_1 = require("@jest/expect-utils");
const matcherUtils = __importStar(require("jest-matcher-utils"));
const jest_util_1 = require("jest-util");
const asymmetricMatchers_1 = require("./asymmetricMatchers");
const extractExpectedAssertionsErrors_1 = __importDefault(require("./extractExpectedAssertionsErrors"));
const jestMatchersObject_1 = require("./jestMatchersObject");
const matchers_1 = __importDefault(require("./matchers"));
const spyMatchers_1 = __importDefault(require("./spyMatchers"));
const toThrowMatchers_1 = __importStar(require("./toThrowMatchers"));
var asymmetricMatchers_2 = require("./asymmetricMatchers");
Object.defineProperty(exports, "AsymmetricMatcher", { enumerable: true, get: function () { return asymmetricMatchers_2.AsymmetricMatcher; } });
class JestAssertionError extends Error {
}
exports.JestAssertionError = JestAssertionError;
const createToThrowErrorMatchingSnapshotMatcher = function (matcher) {
    return function (received, testNameOrInlineSnapshot) {
        return matcher.apply(this, [received, testNameOrInlineSnapshot, true]);
    };
};
const getPromiseMatcher = (name, matcher) => {
    if (name === 'toThrow' || name === 'toThrowError')
        return (0, toThrowMatchers_1.createMatcher)(name, true);
    else if (name === 'toThrowErrorMatchingSnapshot' ||
        name === 'toThrowErrorMatchingInlineSnapshot')
        return createToThrowErrorMatchingSnapshotMatcher(matcher);
    return null;
};
const expect = (actual, ...rest) => {
    if (rest.length !== 0)
        throw new Error('Expect takes at most one argument.');
    const allMatchers = (0, jestMatchersObject_1.getMatchers)();
    const expectation = {
        not: {},
        rejects: { not: {} },
        resolves: { not: {} },
    };
    const err = new JestAssertionError();
    Object.keys(allMatchers).forEach(name => {
        const matcher = allMatchers[name];
        const promiseMatcher = getPromiseMatcher(name, matcher) || matcher;
        expectation[name] = makeThrowingMatcher(matcher, false, '', actual);
        expectation.not[name] = makeThrowingMatcher(matcher, true, '', actual);
        expectation.resolves[name] = makeResolveMatcher(name, promiseMatcher, false, actual, err);
        expectation.resolves.not[name] = makeResolveMatcher(name, promiseMatcher, true, actual, err);
        expectation.rejects[name] = makeRejectMatcher(name, promiseMatcher, false, actual, err);
        expectation.rejects.not[name] = makeRejectMatcher(name, promiseMatcher, true, actual, err);
    });
    return expectation;
};
exports.expect = expect;
const getMessage = (message) => (message && message()) ||
    matcherUtils.RECEIVED_COLOR('No message was specified for this matcher.');
const makeResolveMatcher = (matcherName, matcher, isNot, actual, outerErr) => (...args) => {
    const options = {
        isNot,
        promise: 'resolves',
    };
    if (!(0, jest_util_1.isPromise)(actual)) {
        throw new JestAssertionError(matcherUtils.matcherErrorMessage(matcherUtils.matcherHint(matcherName, undefined, '', options), `${matcherUtils.RECEIVED_COLOR('received')} value must be a promise`, matcherUtils.printWithType('Received', actual, matcherUtils.printReceived)));
    }
    const innerErr = new JestAssertionError();
    return actual.then(result => makeThrowingMatcher(matcher, isNot, 'resolves', result, innerErr).apply(null, args), reason => {
        outerErr.message =
            `${matcherUtils.matcherHint(matcherName, undefined, '', options)}\n\n` +
                'Received promise rejected instead of resolved\n' +
                `Rejected to value: ${matcherUtils.printReceived(reason)}`;
        return Promise.reject(outerErr);
    });
};
const makeRejectMatcher = (matcherName, matcher, isNot, actual, outerErr) => (...args) => {
    const options = {
        isNot,
        promise: 'rejects',
    };
    const actualWrapper = typeof actual === 'function' ? actual() : actual;
    if (!(0, jest_util_1.isPromise)(actualWrapper)) {
        throw new JestAssertionError(matcherUtils.matcherErrorMessage(matcherUtils.matcherHint(matcherName, undefined, '', options), `${matcherUtils.RECEIVED_COLOR('received')} value must be a promise or a function returning a promise`, matcherUtils.printWithType('Received', actual, matcherUtils.printReceived)));
    }
    const innerErr = new JestAssertionError();
    return actualWrapper.then(result => {
        outerErr.message =
            `${matcherUtils.matcherHint(matcherName, undefined, '', options)}\n\n` +
                'Received promise resolved instead of rejected\n' +
                `Resolved to value: ${matcherUtils.printReceived(result)}`;
        return Promise.reject(outerErr);
    }, reason => makeThrowingMatcher(matcher, isNot, 'rejects', reason, innerErr).apply(null, args));
};
const makeThrowingMatcher = (matcher, isNot, promise, actual, err) => function throwingMatcher(...args) {
    let throws = true;
    const utils = {
        ...matcherUtils,
        iterableEquality: expect_utils_1.iterableEquality,
        subsetEquality: expect_utils_1.subsetEquality,
    };
    const matcherUtilsThing = {
        customTesters: (0, jestMatchersObject_1.getCustomEqualityTesters)(),
        // When throws is disabled, the matcher will not throw errors during test
        // execution but instead add them to the global matcher state. If a
        // matcher throws, test execution is normally stopped immediately. The
        // snapshot matcher uses it because we want to log all snapshot
        // failures in a test.
        dontThrow: () => (throws = false),
        equals: expect_utils_1.equals,
        utils,
    };
    const matcherContext = {
        ...(0, jestMatchersObject_1.getState)(),
        ...matcherUtilsThing,
        error: err,
        isNot,
        promise,
    };
    const processResult = (result, asyncError) => {
        _validateResult(result);
        (0, jestMatchersObject_1.getState)().assertionCalls++;
        if ((result.pass && isNot) || (!result.pass && !isNot)) {
            // XOR
            const message = getMessage(result.message);
            let error;
            if (err) {
                error = err;
                error.message = message;
            }
            else if (asyncError) {
                error = asyncError;
                error.message = message;
            }
            else {
                error = new JestAssertionError(message);
                // Try to remove this function from the stack trace frame.
                // Guard for some environments (browsers) that do not support this feature.
                if (Error.captureStackTrace)
                    Error.captureStackTrace(error, throwingMatcher);
            }
            // Passing the result of the matcher with the error so that a custom
            // reporter could access the actual and expected objects of the result
            // for example in order to display a custom visual diff
            error.matcherResult = { ...result, message };
            if (throws)
                throw error;
            else
                (0, jestMatchersObject_1.getState)().suppressedErrors.push(error);
        }
        else {
            (0, jestMatchersObject_1.getState)().numPassingAsserts++;
        }
    };
    const handleError = (error) => {
        if (matcher[jestMatchersObject_1.INTERNAL_MATCHER_FLAG] === true &&
            !(error instanceof JestAssertionError) &&
            error.name !== 'PrettyFormatPluginError' &&
            // Guard for some environments (browsers) that do not support this feature.
            Error.captureStackTrace) {
            // Try to remove this and deeper functions from the stack trace frame.
            Error.captureStackTrace(error, throwingMatcher);
        }
        throw error;
    };
    let potentialResult;
    try {
        potentialResult =
            matcher[jestMatchersObject_1.INTERNAL_MATCHER_FLAG] === true
                ? matcher.call(matcherContext, actual, ...args)
                : // It's a trap specifically for inline snapshot to capture this name
                    // in the stack trace, so that it can correctly get the custom matcher
                    // function call.
                    (function __EXTERNAL_MATCHER_TRAP__() {
                        return matcher.call(matcherContext, actual, ...args);
                    })();
        if ((0, jest_util_1.isPromise)(potentialResult)) {
            const asyncError = new JestAssertionError();
            if (Error.captureStackTrace)
                Error.captureStackTrace(asyncError, throwingMatcher);
            return potentialResult
                .then(aResult => processResult(aResult, asyncError))
                .catch(handleError);
        }
        else {
            return processResult(potentialResult);
        }
    }
    catch (error) {
        return handleError(error);
    }
};
exports.expect.extend = (matchers) => (0, jestMatchersObject_1.setMatchers)(matchers, false, exports.expect);
exports.expect.addEqualityTesters = customTesters => (0, jestMatchersObject_1.addCustomEqualityTesters)(customTesters);
exports.expect.anything = asymmetricMatchers_1.anything;
exports.expect.any = asymmetricMatchers_1.any;
exports.expect.not = {
    arrayContaining: asymmetricMatchers_1.arrayNotContaining,
    closeTo: asymmetricMatchers_1.notCloseTo,
    objectContaining: asymmetricMatchers_1.objectNotContaining,
    stringContaining: asymmetricMatchers_1.stringNotContaining,
    stringMatching: asymmetricMatchers_1.stringNotMatching,
};
exports.expect.arrayContaining = asymmetricMatchers_1.arrayContaining;
exports.expect.closeTo = asymmetricMatchers_1.closeTo;
exports.expect.objectContaining = asymmetricMatchers_1.objectContaining;
exports.expect.stringContaining = asymmetricMatchers_1.stringContaining;
exports.expect.stringMatching = asymmetricMatchers_1.stringMatching;
const _validateResult = (result) => {
    if (typeof result !== 'object' ||
        typeof result.pass !== 'boolean' ||
        (result.message &&
            typeof result.message !== 'string' &&
            typeof result.message !== 'function')) {
        throw new Error('Unexpected return from a matcher function.\n' +
            'Matcher functions should ' +
            'return an object in the following format:\n' +
            '  {message?: string | function, pass: boolean}\n' +
            `'${matcherUtils.stringify(result)}' was returned`);
    }
};
function assertions(expected) {
    const error = new Error();
    if (Error.captureStackTrace)
        Error.captureStackTrace(error, assertions);
    (0, jestMatchersObject_1.setState)({
        expectedAssertionsNumber: expected,
        expectedAssertionsNumberError: error,
    });
}
function hasAssertions(...args) {
    const error = new Error();
    if (Error.captureStackTrace)
        Error.captureStackTrace(error, hasAssertions);
    matcherUtils.ensureNoExpected(args[0], '.hasAssertions');
    (0, jestMatchersObject_1.setState)({
        isExpectingAssertions: true,
        isExpectingAssertionsError: error,
    });
}
// add default jest matchers
(0, jestMatchersObject_1.setMatchers)(matchers_1.default, true, exports.expect);
(0, jestMatchersObject_1.setMatchers)(spyMatchers_1.default, true, exports.expect);
(0, jestMatchersObject_1.setMatchers)(toThrowMatchers_1.default, true, exports.expect);
exports.expect.assertions = assertions;
exports.expect.hasAssertions = hasAssertions;
exports.expect.getState = jestMatchersObject_1.getState;
exports.expect.setState = jestMatchersObject_1.setState;
exports.expect.extractExpectedAssertionsErrors = extractExpectedAssertionsErrors_1.default;
exports.default = exports.expect;
