"use strict";
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
exports.printReceived = exports.RECEIVED_COLOR = exports.INVERTED_COLOR = exports.EXPECTED_COLOR = exports.matcherUtils = exports.asymmetricMatchers = exports.mock = exports.expect = void 0;
const index_1 = __importDefault(require("../third_party/index"));
exports.expect = index_1.default;
exports.mock = __importStar(require("jest-mock"));
const am = __importStar(require("../third_party/asymmetricMatchers"));
const mu = __importStar(require("jest-matcher-utils"));
exports.asymmetricMatchers = {
    any: am.any,
    anything: am.anything,
    arrayContaining: am.arrayContaining,
    arrayNotContaining: am.arrayNotContaining,
    closeTo: am.closeTo,
    notCloseTo: am.notCloseTo,
    objectContaining: am.objectContaining,
    objectNotContaining: am.objectNotContaining,
    stringContaining: am.stringContaining,
    stringMatching: am.stringMatching,
    stringNotContaining: am.stringNotContaining,
    stringNotMatching: am.stringNotMatching,
};
exports.matcherUtils = {
    stringify: mu.stringify,
};
var jest_matcher_utils_1 = require("jest-matcher-utils");
Object.defineProperty(exports, "EXPECTED_COLOR", { enumerable: true, get: function () { return jest_matcher_utils_1.EXPECTED_COLOR; } });
Object.defineProperty(exports, "INVERTED_COLOR", { enumerable: true, get: function () { return jest_matcher_utils_1.INVERTED_COLOR; } });
Object.defineProperty(exports, "RECEIVED_COLOR", { enumerable: true, get: function () { return jest_matcher_utils_1.RECEIVED_COLOR; } });
Object.defineProperty(exports, "printReceived", { enumerable: true, get: function () { return jest_matcher_utils_1.printReceived; } });
