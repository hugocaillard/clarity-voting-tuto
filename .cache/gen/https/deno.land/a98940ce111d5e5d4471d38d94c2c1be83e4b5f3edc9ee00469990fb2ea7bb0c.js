// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/** A library of assertion functions.
 *
 * This module is browser compatible, but do not rely on good formatting of
 * values for AssertionError messages in browsers.
 *
 * @module
 */ import { red, stripColor } from "../fmt/colors.ts";
import { buildMessage, diff, diffstr } from "./_diff.ts";
import { format } from "./_format.ts";
const CAN_NOT_DISPLAY = "[Cannot display]";
export class AssertionError extends Error {
    name = "AssertionError";
    constructor(message){
        super(message);
    }
}
function isKeyedCollection(x) {
    return [
        Symbol.iterator,
        "size"
    ].every((k)=>k in x);
}
/**
 * Deep equality comparison used in assertions
 * @param c actual value
 * @param d expected value
 */ export function equal(c, d) {
    const seen = new Map();
    return function compare(a, b) {
        // Have to render RegExp & Date for string comparison
        // unless it's mistreated as object
        if (a && b && (a instanceof RegExp && b instanceof RegExp || a instanceof URL && b instanceof URL)) {
            return String(a) === String(b);
        }
        if (a instanceof Date && b instanceof Date) {
            const aTime = a.getTime();
            const bTime = b.getTime();
            // Check for NaN equality manually since NaN is not
            // equal to itself.
            if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
                return true;
            }
            return aTime === bTime;
        }
        if (typeof a === "number" && typeof b === "number") {
            return Number.isNaN(a) && Number.isNaN(b) || a === b;
        }
        if (Object.is(a, b)) {
            return true;
        }
        if (a && typeof a === "object" && b && typeof b === "object") {
            if (a && b && !constructorsEqual(a, b)) {
                return false;
            }
            if (a instanceof WeakMap || b instanceof WeakMap) {
                if (!(a instanceof WeakMap && b instanceof WeakMap)) return false;
                throw new TypeError("cannot compare WeakMap instances");
            }
            if (a instanceof WeakSet || b instanceof WeakSet) {
                if (!(a instanceof WeakSet && b instanceof WeakSet)) return false;
                throw new TypeError("cannot compare WeakSet instances");
            }
            if (seen.get(a) === b) {
                return true;
            }
            if (Object.keys(a || {}).length !== Object.keys(b || {}).length) {
                return false;
            }
            seen.set(a, b);
            if (isKeyedCollection(a) && isKeyedCollection(b)) {
                if (a.size !== b.size) {
                    return false;
                }
                let unmatchedEntries = a.size;
                for (const [aKey, aValue] of a.entries()){
                    for (const [bKey, bValue] of b.entries()){
                        /* Given that Map keys can be references, we need
             * to ensure that they are also deeply equal */ if (aKey === aValue && bKey === bValue && compare(aKey, bKey) || compare(aKey, bKey) && compare(aValue, bValue)) {
                            unmatchedEntries--;
                            break;
                        }
                    }
                }
                return unmatchedEntries === 0;
            }
            const merged = {
                ...a,
                ...b
            };
            for (const key of [
                ...Object.getOwnPropertyNames(merged),
                ...Object.getOwnPropertySymbols(merged), 
            ]){
                if (!compare(a && a[key], b && b[key])) {
                    return false;
                }
                if (key in a && !(key in b) || key in b && !(key in a)) {
                    return false;
                }
            }
            if (a instanceof WeakRef || b instanceof WeakRef) {
                if (!(a instanceof WeakRef && b instanceof WeakRef)) return false;
                return compare(a.deref(), b.deref());
            }
            return true;
        }
        return false;
    }(c, d);
}
// deno-lint-ignore ban-types
function constructorsEqual(a, b) {
    return a.constructor === b.constructor || a.constructor === Object && !b.constructor || !a.constructor && b.constructor === Object;
}
/** Make an assertion, error will be thrown if `expr` does not have truthy value. */ export function assert(expr, msg = "") {
    if (!expr) {
        throw new AssertionError(msg);
    }
}
export function assertFalse(expr, msg = "") {
    if (expr) {
        throw new AssertionError(msg);
    }
}
/**
 * Make an assertion that `actual` and `expected` are equal, deeply. If not
 * deeply equal, then throw.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 * For example:
 * ```ts
 * import { assertEquals } from "./asserts.ts";
 *
 * assertEquals<number>(1, 2)
 * ```
 */ export function assertEquals(actual, expected, msg) {
    if (equal(actual, expected)) {
        return;
    }
    let message = "";
    const actualString = format(actual);
    const expectedString = format(expected);
    try {
        const stringDiff = typeof actual === "string" && typeof expected === "string";
        const diffResult = stringDiff ? diffstr(actual, expected) : diff(actualString.split("\n"), expectedString.split("\n"));
        const diffMsg = buildMessage(diffResult, {
            stringDiff
        }).join("\n");
        message = `Values are not equal:\n${diffMsg}`;
    } catch  {
        message = `\n${red(CAN_NOT_DISPLAY)} + \n\n`;
    }
    if (msg) {
        message = msg;
    }
    throw new AssertionError(message);
}
/**
 * Make an assertion that `actual` and `expected` are not equal, deeply.
 * If not then throw.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 * For example:
 * ```ts
 * import { assertNotEquals } from "./asserts.ts";
 *
 * assertNotEquals<number>(1, 2)
 * ```
 */ export function assertNotEquals(actual, expected, msg) {
    if (!equal(actual, expected)) {
        return;
    }
    let actualString;
    let expectedString;
    try {
        actualString = String(actual);
    } catch  {
        actualString = "[Cannot display]";
    }
    try {
        expectedString = String(expected);
    } catch  {
        expectedString = "[Cannot display]";
    }
    if (!msg) {
        msg = `actual: ${actualString} expected not to be: ${expectedString}`;
    }
    throw new AssertionError(msg);
}
/**
 * Make an assertion that `actual` and `expected` are strictly equal. If
 * not then throw.
 *
 * ```ts
 * import { assertStrictEquals } from "./asserts.ts";
 *
 * assertStrictEquals(1, 2)
 * ```
 */ export function assertStrictEquals(actual, expected, msg) {
    if (Object.is(actual, expected)) {
        return;
    }
    let message;
    if (msg) {
        message = msg;
    } else {
        const actualString = format(actual);
        const expectedString = format(expected);
        if (actualString === expectedString) {
            const withOffset = actualString.split("\n").map((l)=>`    ${l}`).join("\n");
            message = `Values have the same structure but are not reference-equal:\n\n${red(withOffset)}\n`;
        } else {
            try {
                const stringDiff = typeof actual === "string" && typeof expected === "string";
                const diffResult = stringDiff ? diffstr(actual, expected) : diff(actualString.split("\n"), expectedString.split("\n"));
                const diffMsg = buildMessage(diffResult, {
                    stringDiff
                }).join("\n");
                message = `Values are not strictly equal:\n${diffMsg}`;
            } catch  {
                message = `\n${red(CAN_NOT_DISPLAY)} + \n\n`;
            }
        }
    }
    throw new AssertionError(message);
}
/**
 * Make an assertion that `actual` and `expected` are not strictly equal.
 * If the values are strictly equal then throw.
 *
 * ```ts
 * import { assertNotStrictEquals } from "./asserts.ts";
 *
 * assertNotStrictEquals(1, 1)
 * ```
 */ export function assertNotStrictEquals(actual, expected, msg) {
    if (!Object.is(actual, expected)) {
        return;
    }
    throw new AssertionError(msg ?? `Expected "actual" to be strictly unequal to: ${format(actual)}\n`);
}
/**
 * Make an assertion that `actual` and `expected` are almost equal numbers through
 * a given tolerance. It can be used to take into account IEEE-754 double-precision
 * floating-point representation limitations.
 * If the values are not almost equal then throw.
 *
 * ```ts
 * import { assertAlmostEquals, assertThrows } from "./asserts.ts";
 *
 * assertAlmostEquals(0.1, 0.2);
 *
 * // Using a custom tolerance value
 * assertAlmostEquals(0.1 + 0.2, 0.3, 1e-16);
 * assertThrows(() => assertAlmostEquals(0.1 + 0.2, 0.3, 1e-17));
 * ```
 */ export function assertAlmostEquals(actual, expected, tolerance = 1e-7, msg) {
    if (Object.is(actual, expected)) {
        return;
    }
    const delta = Math.abs(expected - actual);
    if (delta <= tolerance) {
        return;
    }
    const f = (n)=>Number.isInteger(n) ? n : n.toExponential();
    throw new AssertionError(msg ?? `actual: "${f(actual)}" expected to be close to "${f(expected)}": \
delta "${f(delta)}" is greater than "${f(tolerance)}"`);
}
/**
 * Make an assertion that `obj` is an instance of `type`.
 * If not then throw.
 */ export function assertInstanceOf(actual, expectedType, msg = "") {
    if (!msg) {
        const expectedTypeStr = expectedType.name;
        let actualTypeStr = "";
        if (actual === null) {
            actualTypeStr = "null";
        } else if (actual === undefined) {
            actualTypeStr = "undefined";
        } else if (typeof actual === "object") {
            actualTypeStr = actual.constructor?.name ?? "Object";
        } else {
            actualTypeStr = typeof actual;
        }
        if (expectedTypeStr == actualTypeStr) {
            msg = `Expected object to be an instance of "${expectedTypeStr}".`;
        } else if (actualTypeStr == "function") {
            msg = `Expected object to be an instance of "${expectedTypeStr}" but was not an instanced object.`;
        } else {
            msg = `Expected object to be an instance of "${expectedTypeStr}" but was "${actualTypeStr}".`;
        }
    }
    assert(actual instanceof expectedType, msg);
}
/**
 * Make an assertion that `obj` is not an instance of `type`.
 * If so, then throw.
 */ export function assertNotInstanceOf(actual, // deno-lint-ignore no-explicit-any
unexpectedType, msg = `Expected object to not be an instance of "${typeof unexpectedType}"`) {
    assertFalse(actual instanceof unexpectedType, msg);
}
/**
 * Make an assertion that actual is not null or undefined.
 * If not then throw.
 */ export function assertExists(actual, msg) {
    if (actual === undefined || actual === null) {
        if (!msg) {
            msg = `actual: "${actual}" expected to not be null or undefined`;
        }
        throw new AssertionError(msg);
    }
}
/**
 * Make an assertion that actual includes expected. If not
 * then throw.
 */ export function assertStringIncludes(actual, expected, msg) {
    if (!actual.includes(expected)) {
        if (!msg) {
            msg = `actual: "${actual}" expected to contain: "${expected}"`;
        }
        throw new AssertionError(msg);
    }
}
/**
 * Make an assertion that `actual` includes the `expected` values.
 * If not then an error will be thrown.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 * For example:
 *
 * ```ts
 * import { assertArrayIncludes } from "./asserts.ts";
 *
 * assertArrayIncludes<number>([1, 2], [2])
 * ```
 */ export function assertArrayIncludes(actual, expected, msg) {
    const missing = [];
    for(let i = 0; i < expected.length; i++){
        let found = false;
        for(let j = 0; j < actual.length; j++){
            if (equal(expected[i], actual[j])) {
                found = true;
                break;
            }
        }
        if (!found) {
            missing.push(expected[i]);
        }
    }
    if (missing.length === 0) {
        return;
    }
    if (!msg) {
        msg = `actual: "${format(actual)}" expected to include: "${format(expected)}"\nmissing: ${format(missing)}`;
    }
    throw new AssertionError(msg);
}
/**
 * Make an assertion that `actual` match RegExp `expected`. If not
 * then throw.
 */ export function assertMatch(actual, expected, msg) {
    if (!expected.test(actual)) {
        if (!msg) {
            msg = `actual: "${actual}" expected to match: "${expected}"`;
        }
        throw new AssertionError(msg);
    }
}
/**
 * Make an assertion that `actual` not match RegExp `expected`. If match
 * then throw.
 */ export function assertNotMatch(actual, expected, msg) {
    if (expected.test(actual)) {
        if (!msg) {
            msg = `actual: "${actual}" expected to not match: "${expected}"`;
        }
        throw new AssertionError(msg);
    }
}
/**
 * Make an assertion that `actual` object is a subset of `expected` object, deeply.
 * If not, then throw.
 */ export function assertObjectMatch(// deno-lint-ignore no-explicit-any
actual, expected) {
    function filter(a, b) {
        const seen = new WeakMap();
        return fn(a, b);
        function fn(a, b) {
            // Prevent infinite loop with circular references with same filter
            if (seen.has(a) && seen.get(a) === b) {
                return a;
            }
            seen.set(a, b);
            // Filter keys and symbols which are present in both actual and expected
            const filtered = {};
            const entries = [
                ...Object.getOwnPropertyNames(a),
                ...Object.getOwnPropertySymbols(a), 
            ].filter((key)=>key in b).map((key)=>[
                    key,
                    a[key]
                ]);
            for (const [key, value] of entries){
                // On array references, build a filtered array and filter nested objects inside
                if (Array.isArray(value)) {
                    const subset = b[key];
                    if (Array.isArray(subset)) {
                        filtered[key] = fn({
                            ...value
                        }, {
                            ...subset
                        });
                        continue;
                    }
                } else if (value instanceof RegExp) {
                    filtered[key] = value;
                    continue;
                } else if (typeof value === "object") {
                    const subset1 = b[key];
                    if (typeof subset1 === "object" && subset1) {
                        // When both operands are maps, build a filtered map with common keys and filter nested objects inside
                        if (value instanceof Map && subset1 instanceof Map) {
                            filtered[key] = new Map([
                                ...value
                            ].filter(([k])=>subset1.has(k)).map(([k, v])=>[
                                    k,
                                    typeof v === "object" ? fn(v, subset1.get(k)) : v
                                ]));
                            continue;
                        }
                        // When both operands are set, build a filtered set with common values
                        if (value instanceof Set && subset1 instanceof Set) {
                            filtered[key] = new Set([
                                ...value
                            ].filter((v)=>subset1.has(v)));
                            continue;
                        }
                        filtered[key] = fn(value, subset1);
                        continue;
                    }
                }
                filtered[key] = value;
            }
            return filtered;
        }
    }
    return assertEquals(// get the intersection of "actual" and "expected"
    // side effect: all the instances' constructor field is "Object" now.
    filter(actual, expected), // set (nested) instances' constructor field to be "Object" without changing expected value.
    // see https://github.com/denoland/deno_std/pull/1419
    filter(expected, expected));
}
/**
 * Forcefully throws a failed assertion
 */ export function fail(msg) {
    assert(false, `Failed assertion${msg ? `: ${msg}` : "."}`);
}
/**
 * Make an assertion that `error` is an `Error`.
 * If not then an error will be thrown.
 * An error class and a string that should be included in the
 * error message can also be asserted.
 */ export function assertIsError(error, // deno-lint-ignore no-explicit-any
ErrorClass, msgIncludes, msg) {
    if (error instanceof Error === false) {
        throw new AssertionError(`Expected "error" to be an Error object.`);
    }
    if (ErrorClass && !(error instanceof ErrorClass)) {
        msg = `Expected error to be instance of "${ErrorClass.name}", but was "${typeof error === "object" ? error?.constructor?.name : "[not an object]"}"${msg ? `: ${msg}` : "."}`;
        throw new AssertionError(msg);
    }
    if (msgIncludes && (!(error instanceof Error) || !stripColor(error.message).includes(stripColor(msgIncludes)))) {
        msg = `Expected error message to include "${msgIncludes}", but got "${error instanceof Error ? error.message : "[not an Error]"}"${msg ? `: ${msg}` : "."}`;
        throw new AssertionError(msg);
    }
}
export function assertThrows(fn, errorClassOrCallbackOrMsg, msgIncludesOrMsg, msg) {
    // deno-lint-ignore no-explicit-any
    let ErrorClass = undefined;
    let msgIncludes = undefined;
    let errorCallback = undefined;
    let err;
    if (typeof errorClassOrCallbackOrMsg !== "string") {
        if (errorClassOrCallbackOrMsg === undefined || errorClassOrCallbackOrMsg.prototype instanceof Error || errorClassOrCallbackOrMsg.prototype === Error.prototype) {
            // deno-lint-ignore no-explicit-any
            ErrorClass = errorClassOrCallbackOrMsg;
            msgIncludes = msgIncludesOrMsg;
        } else {
            errorCallback = errorClassOrCallbackOrMsg;
            msg = msgIncludesOrMsg;
        }
    } else {
        msg = errorClassOrCallbackOrMsg;
    }
    let doesThrow = false;
    const msgToAppendToError = msg ? `: ${msg}` : ".";
    try {
        fn();
    } catch (error) {
        if (ErrorClass || errorCallback) {
            if (error instanceof Error === false) {
                throw new AssertionError("A non-Error object was thrown.");
            }
            assertIsError(error, ErrorClass, msgIncludes, msg);
            if (typeof errorCallback === "function") {
                errorCallback(error);
            }
        }
        err = error;
        doesThrow = true;
    }
    if (!doesThrow) {
        msg = `Expected function to throw${msgToAppendToError}`;
        throw new AssertionError(msg);
    }
    return err;
}
export async function assertRejects(fn, errorClassOrCallbackOrMsg, msgIncludesOrMsg, msg) {
    // deno-lint-ignore no-explicit-any
    let ErrorClass = undefined;
    let msgIncludes = undefined;
    let errorCallback = undefined;
    let err;
    if (typeof errorClassOrCallbackOrMsg !== "string") {
        if (errorClassOrCallbackOrMsg === undefined || errorClassOrCallbackOrMsg.prototype instanceof Error || errorClassOrCallbackOrMsg.prototype === Error.prototype) {
            // deno-lint-ignore no-explicit-any
            ErrorClass = errorClassOrCallbackOrMsg;
            msgIncludes = msgIncludesOrMsg;
        } else {
            errorCallback = errorClassOrCallbackOrMsg;
            msg = msgIncludesOrMsg;
        }
    } else {
        msg = errorClassOrCallbackOrMsg;
    }
    let doesThrow = false;
    let isPromiseReturned = false;
    const msgToAppendToError = msg ? `: ${msg}` : ".";
    try {
        const possiblePromise = fn();
        if (possiblePromise && typeof possiblePromise === "object" && typeof possiblePromise.then === "function") {
            isPromiseReturned = true;
            await possiblePromise;
        }
    } catch (error) {
        if (!isPromiseReturned) {
            throw new AssertionError(`Function throws when expected to reject${msgToAppendToError}`);
        }
        if (ErrorClass || errorCallback) {
            if (error instanceof Error === false) {
                throw new AssertionError("A non-Error object was rejected.");
            }
            assertIsError(error, ErrorClass, msgIncludes, msg);
            if (typeof errorCallback == "function") {
                errorCallback(error);
            }
        }
        err = error;
        doesThrow = true;
    }
    if (!doesThrow) {
        throw new AssertionError(`Expected function to reject${msgToAppendToError}`);
    }
    return err;
}
/** Use this to stub out methods that will throw when invoked. */ export function unimplemented(msg) {
    throw new AssertionError(msg || "unimplemented");
}
/** Use this to assert unreachable code. */ export function unreachable() {
    throw new AssertionError("unreachable");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE1OC4wL3Rlc3RpbmcvYXNzZXJ0cy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG4vKiogQSBsaWJyYXJ5IG9mIGFzc2VydGlvbiBmdW5jdGlvbnMuXG4gKlxuICogVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLCBidXQgZG8gbm90IHJlbHkgb24gZ29vZCBmb3JtYXR0aW5nIG9mXG4gKiB2YWx1ZXMgZm9yIEFzc2VydGlvbkVycm9yIG1lc3NhZ2VzIGluIGJyb3dzZXJzLlxuICpcbiAqIEBtb2R1bGVcbiAqL1xuXG5pbXBvcnQgeyByZWQsIHN0cmlwQ29sb3IgfSBmcm9tIFwiLi4vZm10L2NvbG9ycy50c1wiO1xuaW1wb3J0IHsgYnVpbGRNZXNzYWdlLCBkaWZmLCBkaWZmc3RyIH0gZnJvbSBcIi4vX2RpZmYudHNcIjtcbmltcG9ydCB7IGZvcm1hdCB9IGZyb20gXCIuL19mb3JtYXQudHNcIjtcblxuY29uc3QgQ0FOX05PVF9ESVNQTEFZID0gXCJbQ2Fubm90IGRpc3BsYXldXCI7XG5cbmV4cG9ydCBjbGFzcyBBc3NlcnRpb25FcnJvciBleHRlbmRzIEVycm9yIHtcbiAgb3ZlcnJpZGUgbmFtZSA9IFwiQXNzZXJ0aW9uRXJyb3JcIjtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNLZXllZENvbGxlY3Rpb24oeDogdW5rbm93bik6IHggaXMgU2V0PHVua25vd24+IHtcbiAgcmV0dXJuIFtTeW1ib2wuaXRlcmF0b3IsIFwic2l6ZVwiXS5ldmVyeSgoaykgPT4gayBpbiAoeCBhcyBTZXQ8dW5rbm93bj4pKTtcbn1cblxuLyoqXG4gKiBEZWVwIGVxdWFsaXR5IGNvbXBhcmlzb24gdXNlZCBpbiBhc3NlcnRpb25zXG4gKiBAcGFyYW0gYyBhY3R1YWwgdmFsdWVcbiAqIEBwYXJhbSBkIGV4cGVjdGVkIHZhbHVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlcXVhbChjOiB1bmtub3duLCBkOiB1bmtub3duKTogYm9vbGVhbiB7XG4gIGNvbnN0IHNlZW4gPSBuZXcgTWFwKCk7XG4gIHJldHVybiAoZnVuY3Rpb24gY29tcGFyZShhOiB1bmtub3duLCBiOiB1bmtub3duKTogYm9vbGVhbiB7XG4gICAgLy8gSGF2ZSB0byByZW5kZXIgUmVnRXhwICYgRGF0ZSBmb3Igc3RyaW5nIGNvbXBhcmlzb25cbiAgICAvLyB1bmxlc3MgaXQncyBtaXN0cmVhdGVkIGFzIG9iamVjdFxuICAgIGlmIChcbiAgICAgIGEgJiZcbiAgICAgIGIgJiZcbiAgICAgICgoYSBpbnN0YW5jZW9mIFJlZ0V4cCAmJiBiIGluc3RhbmNlb2YgUmVnRXhwKSB8fFxuICAgICAgICAoYSBpbnN0YW5jZW9mIFVSTCAmJiBiIGluc3RhbmNlb2YgVVJMKSlcbiAgICApIHtcbiAgICAgIHJldHVybiBTdHJpbmcoYSkgPT09IFN0cmluZyhiKTtcbiAgICB9XG4gICAgaWYgKGEgaW5zdGFuY2VvZiBEYXRlICYmIGIgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICBjb25zdCBhVGltZSA9IGEuZ2V0VGltZSgpO1xuICAgICAgY29uc3QgYlRpbWUgPSBiLmdldFRpbWUoKTtcbiAgICAgIC8vIENoZWNrIGZvciBOYU4gZXF1YWxpdHkgbWFudWFsbHkgc2luY2UgTmFOIGlzIG5vdFxuICAgICAgLy8gZXF1YWwgdG8gaXRzZWxmLlxuICAgICAgaWYgKE51bWJlci5pc05hTihhVGltZSkgJiYgTnVtYmVyLmlzTmFOKGJUaW1lKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhVGltZSA9PT0gYlRpbWU7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgYSA9PT0gXCJudW1iZXJcIiAmJiB0eXBlb2YgYiA9PT0gXCJudW1iZXJcIikge1xuICAgICAgcmV0dXJuIE51bWJlci5pc05hTihhKSAmJiBOdW1iZXIuaXNOYU4oYikgfHwgYSA9PT0gYjtcbiAgICB9XG4gICAgaWYgKE9iamVjdC5pcyhhLCBiKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmIChhICYmIHR5cGVvZiBhID09PSBcIm9iamVjdFwiICYmIGIgJiYgdHlwZW9mIGIgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIGlmIChhICYmIGIgJiYgIWNvbnN0cnVjdG9yc0VxdWFsKGEsIGIpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmIChhIGluc3RhbmNlb2YgV2Vha01hcCB8fCBiIGluc3RhbmNlb2YgV2Vha01hcCkge1xuICAgICAgICBpZiAoIShhIGluc3RhbmNlb2YgV2Vha01hcCAmJiBiIGluc3RhbmNlb2YgV2Vha01hcCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCBjb21wYXJlIFdlYWtNYXAgaW5zdGFuY2VzXCIpO1xuICAgICAgfVxuICAgICAgaWYgKGEgaW5zdGFuY2VvZiBXZWFrU2V0IHx8IGIgaW5zdGFuY2VvZiBXZWFrU2V0KSB7XG4gICAgICAgIGlmICghKGEgaW5zdGFuY2VvZiBXZWFrU2V0ICYmIGIgaW5zdGFuY2VvZiBXZWFrU2V0KSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IGNvbXBhcmUgV2Vha1NldCBpbnN0YW5jZXNcIik7XG4gICAgICB9XG4gICAgICBpZiAoc2Vlbi5nZXQoYSkgPT09IGIpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBpZiAoT2JqZWN0LmtleXMoYSB8fCB7fSkubGVuZ3RoICE9PSBPYmplY3Qua2V5cyhiIHx8IHt9KS5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgc2Vlbi5zZXQoYSwgYik7XG4gICAgICBpZiAoaXNLZXllZENvbGxlY3Rpb24oYSkgJiYgaXNLZXllZENvbGxlY3Rpb24oYikpIHtcbiAgICAgICAgaWYgKGEuc2l6ZSAhPT0gYi5zaXplKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHVubWF0Y2hlZEVudHJpZXMgPSBhLnNpemU7XG5cbiAgICAgICAgZm9yIChjb25zdCBbYUtleSwgYVZhbHVlXSBvZiBhLmVudHJpZXMoKSkge1xuICAgICAgICAgIGZvciAoY29uc3QgW2JLZXksIGJWYWx1ZV0gb2YgYi5lbnRyaWVzKCkpIHtcbiAgICAgICAgICAgIC8qIEdpdmVuIHRoYXQgTWFwIGtleXMgY2FuIGJlIHJlZmVyZW5jZXMsIHdlIG5lZWRcbiAgICAgICAgICAgICAqIHRvIGVuc3VyZSB0aGF0IHRoZXkgYXJlIGFsc28gZGVlcGx5IGVxdWFsICovXG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIChhS2V5ID09PSBhVmFsdWUgJiYgYktleSA9PT0gYlZhbHVlICYmIGNvbXBhcmUoYUtleSwgYktleSkpIHx8XG4gICAgICAgICAgICAgIChjb21wYXJlKGFLZXksIGJLZXkpICYmIGNvbXBhcmUoYVZhbHVlLCBiVmFsdWUpKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIHVubWF0Y2hlZEVudHJpZXMtLTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHVubWF0Y2hlZEVudHJpZXMgPT09IDA7XG4gICAgICB9XG4gICAgICBjb25zdCBtZXJnZWQgPSB7IC4uLmEsIC4uLmIgfTtcbiAgICAgIGZvciAoXG4gICAgICAgIGNvbnN0IGtleSBvZiBbXG4gICAgICAgICAgLi4uT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMobWVyZ2VkKSxcbiAgICAgICAgICAuLi5PYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKG1lcmdlZCksXG4gICAgICAgIF1cbiAgICAgICkge1xuICAgICAgICB0eXBlIEtleSA9IGtleW9mIHR5cGVvZiBtZXJnZWQ7XG4gICAgICAgIGlmICghY29tcGFyZShhICYmIGFba2V5IGFzIEtleV0sIGIgJiYgYltrZXkgYXMgS2V5XSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCgoa2V5IGluIGEpICYmICghKGtleSBpbiBiKSkpIHx8ICgoa2V5IGluIGIpICYmICghKGtleSBpbiBhKSkpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoYSBpbnN0YW5jZW9mIFdlYWtSZWYgfHwgYiBpbnN0YW5jZW9mIFdlYWtSZWYpIHtcbiAgICAgICAgaWYgKCEoYSBpbnN0YW5jZW9mIFdlYWtSZWYgJiYgYiBpbnN0YW5jZW9mIFdlYWtSZWYpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBjb21wYXJlKGEuZGVyZWYoKSwgYi5kZXJlZigpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH0pKGMsIGQpO1xufVxuXG4vLyBkZW5vLWxpbnQtaWdub3JlIGJhbi10eXBlc1xuZnVuY3Rpb24gY29uc3RydWN0b3JzRXF1YWwoYTogb2JqZWN0LCBiOiBvYmplY3QpIHtcbiAgcmV0dXJuIGEuY29uc3RydWN0b3IgPT09IGIuY29uc3RydWN0b3IgfHxcbiAgICBhLmNvbnN0cnVjdG9yID09PSBPYmplY3QgJiYgIWIuY29uc3RydWN0b3IgfHxcbiAgICAhYS5jb25zdHJ1Y3RvciAmJiBiLmNvbnN0cnVjdG9yID09PSBPYmplY3Q7XG59XG5cbi8qKiBNYWtlIGFuIGFzc2VydGlvbiwgZXJyb3Igd2lsbCBiZSB0aHJvd24gaWYgYGV4cHJgIGRvZXMgbm90IGhhdmUgdHJ1dGh5IHZhbHVlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydChleHByOiB1bmtub3duLCBtc2cgPSBcIlwiKTogYXNzZXJ0cyBleHByIHtcbiAgaWYgKCFleHByKSB7XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbn1cblxuLyoqIE1ha2UgYW4gYXNzZXJ0aW9uLCBlcnJvciB3aWxsIGJlIHRocm93biBpZiBgZXhwcmAgaGF2ZSB0cnV0aHkgdmFsdWUuICovXG50eXBlIEZhbHN5ID0gZmFsc2UgfCAwIHwgMG4gfCBcIlwiIHwgbnVsbCB8IHVuZGVmaW5lZDtcbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRGYWxzZShleHByOiB1bmtub3duLCBtc2cgPSBcIlwiKTogYXNzZXJ0cyBleHByIGlzIEZhbHN5IHtcbiAgaWYgKGV4cHIpIHtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobXNnKTtcbiAgfVxufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAgYXJlIGVxdWFsLCBkZWVwbHkuIElmIG5vdFxuICogZGVlcGx5IGVxdWFsLCB0aGVuIHRocm93LlxuICpcbiAqIFR5cGUgcGFyYW1ldGVyIGNhbiBiZSBzcGVjaWZpZWQgdG8gZW5zdXJlIHZhbHVlcyB1bmRlciBjb21wYXJpc29uIGhhdmUgdGhlIHNhbWUgdHlwZS5cbiAqIEZvciBleGFtcGxlOlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGFzc2VydEVxdWFscyB9IGZyb20gXCIuL2Fzc2VydHMudHNcIjtcbiAqXG4gKiBhc3NlcnRFcXVhbHM8bnVtYmVyPigxLCAyKVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRFcXVhbHM8VD4oYWN0dWFsOiBULCBleHBlY3RlZDogVCwgbXNnPzogc3RyaW5nKSB7XG4gIGlmIChlcXVhbChhY3R1YWwsIGV4cGVjdGVkKSkge1xuICAgIHJldHVybjtcbiAgfVxuICBsZXQgbWVzc2FnZSA9IFwiXCI7XG4gIGNvbnN0IGFjdHVhbFN0cmluZyA9IGZvcm1hdChhY3R1YWwpO1xuICBjb25zdCBleHBlY3RlZFN0cmluZyA9IGZvcm1hdChleHBlY3RlZCk7XG4gIHRyeSB7XG4gICAgY29uc3Qgc3RyaW5nRGlmZiA9ICh0eXBlb2YgYWN0dWFsID09PSBcInN0cmluZ1wiKSAmJlxuICAgICAgKHR5cGVvZiBleHBlY3RlZCA9PT0gXCJzdHJpbmdcIik7XG4gICAgY29uc3QgZGlmZlJlc3VsdCA9IHN0cmluZ0RpZmZcbiAgICAgID8gZGlmZnN0cihhY3R1YWwgYXMgc3RyaW5nLCBleHBlY3RlZCBhcyBzdHJpbmcpXG4gICAgICA6IGRpZmYoYWN0dWFsU3RyaW5nLnNwbGl0KFwiXFxuXCIpLCBleHBlY3RlZFN0cmluZy5zcGxpdChcIlxcblwiKSk7XG4gICAgY29uc3QgZGlmZk1zZyA9IGJ1aWxkTWVzc2FnZShkaWZmUmVzdWx0LCB7IHN0cmluZ0RpZmYgfSkuam9pbihcIlxcblwiKTtcbiAgICBtZXNzYWdlID0gYFZhbHVlcyBhcmUgbm90IGVxdWFsOlxcbiR7ZGlmZk1zZ31gO1xuICB9IGNhdGNoIHtcbiAgICBtZXNzYWdlID0gYFxcbiR7cmVkKENBTl9OT1RfRElTUExBWSl9ICsgXFxuXFxuYDtcbiAgfVxuICBpZiAobXNnKSB7XG4gICAgbWVzc2FnZSA9IG1zZztcbiAgfVxuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobWVzc2FnZSk7XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBhbmQgYGV4cGVjdGVkYCBhcmUgbm90IGVxdWFsLCBkZWVwbHkuXG4gKiBJZiBub3QgdGhlbiB0aHJvdy5cbiAqXG4gKiBUeXBlIHBhcmFtZXRlciBjYW4gYmUgc3BlY2lmaWVkIHRvIGVuc3VyZSB2YWx1ZXMgdW5kZXIgY29tcGFyaXNvbiBoYXZlIHRoZSBzYW1lIHR5cGUuXG4gKiBGb3IgZXhhbXBsZTpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBhc3NlcnROb3RFcXVhbHMgfSBmcm9tIFwiLi9hc3NlcnRzLnRzXCI7XG4gKlxuICogYXNzZXJ0Tm90RXF1YWxzPG51bWJlcj4oMSwgMilcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0Tm90RXF1YWxzPFQ+KGFjdHVhbDogVCwgZXhwZWN0ZWQ6IFQsIG1zZz86IHN0cmluZykge1xuICBpZiAoIWVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGxldCBhY3R1YWxTdHJpbmc6IHN0cmluZztcbiAgbGV0IGV4cGVjdGVkU3RyaW5nOiBzdHJpbmc7XG4gIHRyeSB7XG4gICAgYWN0dWFsU3RyaW5nID0gU3RyaW5nKGFjdHVhbCk7XG4gIH0gY2F0Y2gge1xuICAgIGFjdHVhbFN0cmluZyA9IFwiW0Nhbm5vdCBkaXNwbGF5XVwiO1xuICB9XG4gIHRyeSB7XG4gICAgZXhwZWN0ZWRTdHJpbmcgPSBTdHJpbmcoZXhwZWN0ZWQpO1xuICB9IGNhdGNoIHtcbiAgICBleHBlY3RlZFN0cmluZyA9IFwiW0Nhbm5vdCBkaXNwbGF5XVwiO1xuICB9XG4gIGlmICghbXNnKSB7XG4gICAgbXNnID0gYGFjdHVhbDogJHthY3R1YWxTdHJpbmd9IGV4cGVjdGVkIG5vdCB0byBiZTogJHtleHBlY3RlZFN0cmluZ31gO1xuICB9XG4gIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAgYXJlIHN0cmljdGx5IGVxdWFsLiBJZlxuICogbm90IHRoZW4gdGhyb3cuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGFzc2VydFN0cmljdEVxdWFscyB9IGZyb20gXCIuL2Fzc2VydHMudHNcIjtcbiAqXG4gKiBhc3NlcnRTdHJpY3RFcXVhbHMoMSwgMilcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0U3RyaWN0RXF1YWxzPFQ+KFxuICBhY3R1YWw6IHVua25vd24sXG4gIGV4cGVjdGVkOiBULFxuICBtc2c/OiBzdHJpbmcsXG4pOiBhc3NlcnRzIGFjdHVhbCBpcyBUIHtcbiAgaWYgKE9iamVjdC5pcyhhY3R1YWwsIGV4cGVjdGVkKSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxldCBtZXNzYWdlOiBzdHJpbmc7XG5cbiAgaWYgKG1zZykge1xuICAgIG1lc3NhZ2UgPSBtc2c7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgYWN0dWFsU3RyaW5nID0gZm9ybWF0KGFjdHVhbCk7XG4gICAgY29uc3QgZXhwZWN0ZWRTdHJpbmcgPSBmb3JtYXQoZXhwZWN0ZWQpO1xuXG4gICAgaWYgKGFjdHVhbFN0cmluZyA9PT0gZXhwZWN0ZWRTdHJpbmcpIHtcbiAgICAgIGNvbnN0IHdpdGhPZmZzZXQgPSBhY3R1YWxTdHJpbmdcbiAgICAgICAgLnNwbGl0KFwiXFxuXCIpXG4gICAgICAgIC5tYXAoKGwpID0+IGAgICAgJHtsfWApXG4gICAgICAgIC5qb2luKFwiXFxuXCIpO1xuICAgICAgbWVzc2FnZSA9XG4gICAgICAgIGBWYWx1ZXMgaGF2ZSB0aGUgc2FtZSBzdHJ1Y3R1cmUgYnV0IGFyZSBub3QgcmVmZXJlbmNlLWVxdWFsOlxcblxcbiR7XG4gICAgICAgICAgcmVkKHdpdGhPZmZzZXQpXG4gICAgICAgIH1cXG5gO1xuICAgIH0gZWxzZSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBzdHJpbmdEaWZmID0gKHR5cGVvZiBhY3R1YWwgPT09IFwic3RyaW5nXCIpICYmXG4gICAgICAgICAgKHR5cGVvZiBleHBlY3RlZCA9PT0gXCJzdHJpbmdcIik7XG4gICAgICAgIGNvbnN0IGRpZmZSZXN1bHQgPSBzdHJpbmdEaWZmXG4gICAgICAgICAgPyBkaWZmc3RyKGFjdHVhbCBhcyBzdHJpbmcsIGV4cGVjdGVkIGFzIHN0cmluZylcbiAgICAgICAgICA6IGRpZmYoYWN0dWFsU3RyaW5nLnNwbGl0KFwiXFxuXCIpLCBleHBlY3RlZFN0cmluZy5zcGxpdChcIlxcblwiKSk7XG4gICAgICAgIGNvbnN0IGRpZmZNc2cgPSBidWlsZE1lc3NhZ2UoZGlmZlJlc3VsdCwgeyBzdHJpbmdEaWZmIH0pLmpvaW4oXCJcXG5cIik7XG4gICAgICAgIG1lc3NhZ2UgPSBgVmFsdWVzIGFyZSBub3Qgc3RyaWN0bHkgZXF1YWw6XFxuJHtkaWZmTXNnfWA7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgbWVzc2FnZSA9IGBcXG4ke3JlZChDQU5fTk9UX0RJU1BMQVkpfSArIFxcblxcbmA7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1lc3NhZ2UpO1xufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAgYXJlIG5vdCBzdHJpY3RseSBlcXVhbC5cbiAqIElmIHRoZSB2YWx1ZXMgYXJlIHN0cmljdGx5IGVxdWFsIHRoZW4gdGhyb3cuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGFzc2VydE5vdFN0cmljdEVxdWFscyB9IGZyb20gXCIuL2Fzc2VydHMudHNcIjtcbiAqXG4gKiBhc3NlcnROb3RTdHJpY3RFcXVhbHMoMSwgMSlcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0Tm90U3RyaWN0RXF1YWxzPFQ+KFxuICBhY3R1YWw6IFQsXG4gIGV4cGVjdGVkOiBULFxuICBtc2c/OiBzdHJpbmcsXG4pIHtcbiAgaWYgKCFPYmplY3QuaXMoYWN0dWFsLCBleHBlY3RlZCkpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXG4gICAgbXNnID8/IGBFeHBlY3RlZCBcImFjdHVhbFwiIHRvIGJlIHN0cmljdGx5IHVuZXF1YWwgdG86ICR7Zm9ybWF0KGFjdHVhbCl9XFxuYCxcbiAgKTtcbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGBhY3R1YWxgIGFuZCBgZXhwZWN0ZWRgIGFyZSBhbG1vc3QgZXF1YWwgbnVtYmVycyB0aHJvdWdoXG4gKiBhIGdpdmVuIHRvbGVyYW5jZS4gSXQgY2FuIGJlIHVzZWQgdG8gdGFrZSBpbnRvIGFjY291bnQgSUVFRS03NTQgZG91YmxlLXByZWNpc2lvblxuICogZmxvYXRpbmctcG9pbnQgcmVwcmVzZW50YXRpb24gbGltaXRhdGlvbnMuXG4gKiBJZiB0aGUgdmFsdWVzIGFyZSBub3QgYWxtb3N0IGVxdWFsIHRoZW4gdGhyb3cuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGFzc2VydEFsbW9zdEVxdWFscywgYXNzZXJ0VGhyb3dzIH0gZnJvbSBcIi4vYXNzZXJ0cy50c1wiO1xuICpcbiAqIGFzc2VydEFsbW9zdEVxdWFscygwLjEsIDAuMik7XG4gKlxuICogLy8gVXNpbmcgYSBjdXN0b20gdG9sZXJhbmNlIHZhbHVlXG4gKiBhc3NlcnRBbG1vc3RFcXVhbHMoMC4xICsgMC4yLCAwLjMsIDFlLTE2KTtcbiAqIGFzc2VydFRocm93cygoKSA9PiBhc3NlcnRBbG1vc3RFcXVhbHMoMC4xICsgMC4yLCAwLjMsIDFlLTE3KSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydEFsbW9zdEVxdWFscyhcbiAgYWN0dWFsOiBudW1iZXIsXG4gIGV4cGVjdGVkOiBudW1iZXIsXG4gIHRvbGVyYW5jZSA9IDFlLTcsXG4gIG1zZz86IHN0cmluZyxcbikge1xuICBpZiAoT2JqZWN0LmlzKGFjdHVhbCwgZXhwZWN0ZWQpKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IGRlbHRhID0gTWF0aC5hYnMoZXhwZWN0ZWQgLSBhY3R1YWwpO1xuICBpZiAoZGVsdGEgPD0gdG9sZXJhbmNlKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IGYgPSAobjogbnVtYmVyKSA9PiBOdW1iZXIuaXNJbnRlZ2VyKG4pID8gbiA6IG4udG9FeHBvbmVudGlhbCgpO1xuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXG4gICAgbXNnID8/XG4gICAgICBgYWN0dWFsOiBcIiR7ZihhY3R1YWwpfVwiIGV4cGVjdGVkIHRvIGJlIGNsb3NlIHRvIFwiJHtmKGV4cGVjdGVkKX1cIjogXFxcbmRlbHRhIFwiJHtmKGRlbHRhKX1cIiBpcyBncmVhdGVyIHRoYW4gXCIke2YodG9sZXJhbmNlKX1cImAsXG4gICk7XG59XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG50eXBlIEFueUNvbnN0cnVjdG9yID0gbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gYW55O1xudHlwZSBHZXRDb25zdHJ1Y3RvclR5cGU8VCBleHRlbmRzIEFueUNvbnN0cnVjdG9yPiA9IFQgZXh0ZW5kcyAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxubmV3ICguLi5hcmdzOiBhbnkpID0+IGluZmVyIEMgPyBDXG4gIDogbmV2ZXI7XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgb2JqYCBpcyBhbiBpbnN0YW5jZSBvZiBgdHlwZWAuXG4gKiBJZiBub3QgdGhlbiB0aHJvdy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydEluc3RhbmNlT2Y8VCBleHRlbmRzIEFueUNvbnN0cnVjdG9yPihcbiAgYWN0dWFsOiB1bmtub3duLFxuICBleHBlY3RlZFR5cGU6IFQsXG4gIG1zZyA9IFwiXCIsXG4pOiBhc3NlcnRzIGFjdHVhbCBpcyBHZXRDb25zdHJ1Y3RvclR5cGU8VD4ge1xuICBpZiAoIW1zZykge1xuICAgIGNvbnN0IGV4cGVjdGVkVHlwZVN0ciA9IGV4cGVjdGVkVHlwZS5uYW1lO1xuXG4gICAgbGV0IGFjdHVhbFR5cGVTdHIgPSBcIlwiO1xuICAgIGlmIChhY3R1YWwgPT09IG51bGwpIHtcbiAgICAgIGFjdHVhbFR5cGVTdHIgPSBcIm51bGxcIjtcbiAgICB9IGVsc2UgaWYgKGFjdHVhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBhY3R1YWxUeXBlU3RyID0gXCJ1bmRlZmluZWRcIjtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBhY3R1YWwgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIGFjdHVhbFR5cGVTdHIgPSBhY3R1YWwuY29uc3RydWN0b3I/Lm5hbWUgPz8gXCJPYmplY3RcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgYWN0dWFsVHlwZVN0ciA9IHR5cGVvZiBhY3R1YWw7XG4gICAgfVxuXG4gICAgaWYgKGV4cGVjdGVkVHlwZVN0ciA9PSBhY3R1YWxUeXBlU3RyKSB7XG4gICAgICBtc2cgPSBgRXhwZWN0ZWQgb2JqZWN0IHRvIGJlIGFuIGluc3RhbmNlIG9mIFwiJHtleHBlY3RlZFR5cGVTdHJ9XCIuYDtcbiAgICB9IGVsc2UgaWYgKGFjdHVhbFR5cGVTdHIgPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBtc2cgPVxuICAgICAgICBgRXhwZWN0ZWQgb2JqZWN0IHRvIGJlIGFuIGluc3RhbmNlIG9mIFwiJHtleHBlY3RlZFR5cGVTdHJ9XCIgYnV0IHdhcyBub3QgYW4gaW5zdGFuY2VkIG9iamVjdC5gO1xuICAgIH0gZWxzZSB7XG4gICAgICBtc2cgPVxuICAgICAgICBgRXhwZWN0ZWQgb2JqZWN0IHRvIGJlIGFuIGluc3RhbmNlIG9mIFwiJHtleHBlY3RlZFR5cGVTdHJ9XCIgYnV0IHdhcyBcIiR7YWN0dWFsVHlwZVN0cn1cIi5gO1xuICAgIH1cbiAgfVxuICBhc3NlcnQoYWN0dWFsIGluc3RhbmNlb2YgZXhwZWN0ZWRUeXBlLCBtc2cpO1xufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYG9iamAgaXMgbm90IGFuIGluc3RhbmNlIG9mIGB0eXBlYC5cbiAqIElmIHNvLCB0aGVuIHRocm93LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0Tm90SW5zdGFuY2VPZjxBLCBUPihcbiAgYWN0dWFsOiBBLFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICB1bmV4cGVjdGVkVHlwZTogbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gVCxcbiAgbXNnID0gYEV4cGVjdGVkIG9iamVjdCB0byBub3QgYmUgYW4gaW5zdGFuY2Ugb2YgXCIke3R5cGVvZiB1bmV4cGVjdGVkVHlwZX1cImAsXG4pOiBhc3NlcnRzIGFjdHVhbCBpcyBFeGNsdWRlPEEsIFQ+IHtcbiAgYXNzZXJ0RmFsc2UoYWN0dWFsIGluc3RhbmNlb2YgdW5leHBlY3RlZFR5cGUsIG1zZyk7XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBhY3R1YWwgaXMgbm90IG51bGwgb3IgdW5kZWZpbmVkLlxuICogSWYgbm90IHRoZW4gdGhyb3cuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRFeGlzdHM8VD4oXG4gIGFjdHVhbDogVCxcbiAgbXNnPzogc3RyaW5nLFxuKTogYXNzZXJ0cyBhY3R1YWwgaXMgTm9uTnVsbGFibGU8VD4ge1xuICBpZiAoYWN0dWFsID09PSB1bmRlZmluZWQgfHwgYWN0dWFsID09PSBudWxsKSB7XG4gICAgaWYgKCFtc2cpIHtcbiAgICAgIG1zZyA9IGBhY3R1YWw6IFwiJHthY3R1YWx9XCIgZXhwZWN0ZWQgdG8gbm90IGJlIG51bGwgb3IgdW5kZWZpbmVkYDtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGFjdHVhbCBpbmNsdWRlcyBleHBlY3RlZC4gSWYgbm90XG4gKiB0aGVuIHRocm93LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0U3RyaW5nSW5jbHVkZXMoXG4gIGFjdHVhbDogc3RyaW5nLFxuICBleHBlY3RlZDogc3RyaW5nLFxuICBtc2c/OiBzdHJpbmcsXG4pIHtcbiAgaWYgKCFhY3R1YWwuaW5jbHVkZXMoZXhwZWN0ZWQpKSB7XG4gICAgaWYgKCFtc2cpIHtcbiAgICAgIG1zZyA9IGBhY3R1YWw6IFwiJHthY3R1YWx9XCIgZXhwZWN0ZWQgdG8gY29udGFpbjogXCIke2V4cGVjdGVkfVwiYDtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGBhY3R1YWxgIGluY2x1ZGVzIHRoZSBgZXhwZWN0ZWRgIHZhbHVlcy5cbiAqIElmIG5vdCB0aGVuIGFuIGVycm9yIHdpbGwgYmUgdGhyb3duLlxuICpcbiAqIFR5cGUgcGFyYW1ldGVyIGNhbiBiZSBzcGVjaWZpZWQgdG8gZW5zdXJlIHZhbHVlcyB1bmRlciBjb21wYXJpc29uIGhhdmUgdGhlIHNhbWUgdHlwZS5cbiAqIEZvciBleGFtcGxlOlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBhc3NlcnRBcnJheUluY2x1ZGVzIH0gZnJvbSBcIi4vYXNzZXJ0cy50c1wiO1xuICpcbiAqIGFzc2VydEFycmF5SW5jbHVkZXM8bnVtYmVyPihbMSwgMl0sIFsyXSlcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0QXJyYXlJbmNsdWRlczxUPihcbiAgYWN0dWFsOiBBcnJheUxpa2U8VD4sXG4gIGV4cGVjdGVkOiBBcnJheUxpa2U8VD4sXG4gIG1zZz86IHN0cmluZyxcbikge1xuICBjb25zdCBtaXNzaW5nOiB1bmtub3duW10gPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHBlY3RlZC5sZW5ndGg7IGkrKykge1xuICAgIGxldCBmb3VuZCA9IGZhbHNlO1xuICAgIGZvciAobGV0IGogPSAwOyBqIDwgYWN0dWFsLmxlbmd0aDsgaisrKSB7XG4gICAgICBpZiAoZXF1YWwoZXhwZWN0ZWRbaV0sIGFjdHVhbFtqXSkpIHtcbiAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFmb3VuZCkge1xuICAgICAgbWlzc2luZy5wdXNoKGV4cGVjdGVkW2ldKTtcbiAgICB9XG4gIH1cbiAgaWYgKG1pc3NpbmcubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICghbXNnKSB7XG4gICAgbXNnID0gYGFjdHVhbDogXCIke2Zvcm1hdChhY3R1YWwpfVwiIGV4cGVjdGVkIHRvIGluY2x1ZGU6IFwiJHtcbiAgICAgIGZvcm1hdChleHBlY3RlZClcbiAgICB9XCJcXG5taXNzaW5nOiAke2Zvcm1hdChtaXNzaW5nKX1gO1xuICB9XG4gIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGFjdHVhbGAgbWF0Y2ggUmVnRXhwIGBleHBlY3RlZGAuIElmIG5vdFxuICogdGhlbiB0aHJvdy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydE1hdGNoKFxuICBhY3R1YWw6IHN0cmluZyxcbiAgZXhwZWN0ZWQ6IFJlZ0V4cCxcbiAgbXNnPzogc3RyaW5nLFxuKSB7XG4gIGlmICghZXhwZWN0ZWQudGVzdChhY3R1YWwpKSB7XG4gICAgaWYgKCFtc2cpIHtcbiAgICAgIG1zZyA9IGBhY3R1YWw6IFwiJHthY3R1YWx9XCIgZXhwZWN0ZWQgdG8gbWF0Y2g6IFwiJHtleHBlY3RlZH1cImA7XG4gICAgfVxuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xuICB9XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBub3QgbWF0Y2ggUmVnRXhwIGBleHBlY3RlZGAuIElmIG1hdGNoXG4gKiB0aGVuIHRocm93LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0Tm90TWF0Y2goXG4gIGFjdHVhbDogc3RyaW5nLFxuICBleHBlY3RlZDogUmVnRXhwLFxuICBtc2c/OiBzdHJpbmcsXG4pIHtcbiAgaWYgKGV4cGVjdGVkLnRlc3QoYWN0dWFsKSkge1xuICAgIGlmICghbXNnKSB7XG4gICAgICBtc2cgPSBgYWN0dWFsOiBcIiR7YWN0dWFsfVwiIGV4cGVjdGVkIHRvIG5vdCBtYXRjaDogXCIke2V4cGVjdGVkfVwiYDtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGBhY3R1YWxgIG9iamVjdCBpcyBhIHN1YnNldCBvZiBgZXhwZWN0ZWRgIG9iamVjdCwgZGVlcGx5LlxuICogSWYgbm90LCB0aGVuIHRocm93LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0T2JqZWN0TWF0Y2goXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGFjdHVhbDogUmVjb3JkPFByb3BlcnR5S2V5LCBhbnk+LFxuICBleHBlY3RlZDogUmVjb3JkPFByb3BlcnR5S2V5LCB1bmtub3duPixcbikge1xuICB0eXBlIGxvb3NlID0gUmVjb3JkPFByb3BlcnR5S2V5LCB1bmtub3duPjtcblxuICBmdW5jdGlvbiBmaWx0ZXIoYTogbG9vc2UsIGI6IGxvb3NlKSB7XG4gICAgY29uc3Qgc2VlbiA9IG5ldyBXZWFrTWFwKCk7XG4gICAgcmV0dXJuIGZuKGEsIGIpO1xuXG4gICAgZnVuY3Rpb24gZm4oYTogbG9vc2UsIGI6IGxvb3NlKTogbG9vc2Uge1xuICAgICAgLy8gUHJldmVudCBpbmZpbml0ZSBsb29wIHdpdGggY2lyY3VsYXIgcmVmZXJlbmNlcyB3aXRoIHNhbWUgZmlsdGVyXG4gICAgICBpZiAoKHNlZW4uaGFzKGEpKSAmJiAoc2Vlbi5nZXQoYSkgPT09IGIpKSB7XG4gICAgICAgIHJldHVybiBhO1xuICAgICAgfVxuICAgICAgc2Vlbi5zZXQoYSwgYik7XG4gICAgICAvLyBGaWx0ZXIga2V5cyBhbmQgc3ltYm9scyB3aGljaCBhcmUgcHJlc2VudCBpbiBib3RoIGFjdHVhbCBhbmQgZXhwZWN0ZWRcbiAgICAgIGNvbnN0IGZpbHRlcmVkID0ge30gYXMgbG9vc2U7XG4gICAgICBjb25zdCBlbnRyaWVzID0gW1xuICAgICAgICAuLi5PYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhKSxcbiAgICAgICAgLi4uT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhhKSxcbiAgICAgIF1cbiAgICAgICAgLmZpbHRlcigoa2V5KSA9PiBrZXkgaW4gYilcbiAgICAgICAgLm1hcCgoa2V5KSA9PiBba2V5LCBhW2tleSBhcyBzdHJpbmddXSkgYXMgQXJyYXk8W3N0cmluZywgdW5rbm93bl0+O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgZW50cmllcykge1xuICAgICAgICAvLyBPbiBhcnJheSByZWZlcmVuY2VzLCBidWlsZCBhIGZpbHRlcmVkIGFycmF5IGFuZCBmaWx0ZXIgbmVzdGVkIG9iamVjdHMgaW5zaWRlXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgIGNvbnN0IHN1YnNldCA9IChiIGFzIGxvb3NlKVtrZXldO1xuICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHN1YnNldCkpIHtcbiAgICAgICAgICAgIGZpbHRlcmVkW2tleV0gPSBmbih7IC4uLnZhbHVlIH0sIHsgLi4uc3Vic2V0IH0pO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IC8vIE9uIHJlZ2V4cCByZWZlcmVuY2VzLCBrZWVwIHZhbHVlIGFzIGl0IHRvIGF2b2lkIGxvb3NpbmcgcGF0dGVybiBhbmQgZmxhZ3NcbiAgICAgICAgZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gdmFsdWU7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH0gLy8gT24gbmVzdGVkIG9iamVjdHMgcmVmZXJlbmNlcywgYnVpbGQgYSBmaWx0ZXJlZCBvYmplY3QgcmVjdXJzaXZlbHlcbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgY29uc3Qgc3Vic2V0ID0gKGIgYXMgbG9vc2UpW2tleV07XG4gICAgICAgICAgaWYgKCh0eXBlb2Ygc3Vic2V0ID09PSBcIm9iamVjdFwiKSAmJiAoc3Vic2V0KSkge1xuICAgICAgICAgICAgLy8gV2hlbiBib3RoIG9wZXJhbmRzIGFyZSBtYXBzLCBidWlsZCBhIGZpbHRlcmVkIG1hcCB3aXRoIGNvbW1vbiBrZXlzIGFuZCBmaWx0ZXIgbmVzdGVkIG9iamVjdHMgaW5zaWRlXG4gICAgICAgICAgICBpZiAoKHZhbHVlIGluc3RhbmNlb2YgTWFwKSAmJiAoc3Vic2V0IGluc3RhbmNlb2YgTWFwKSkge1xuICAgICAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gbmV3IE1hcChcbiAgICAgICAgICAgICAgICBbLi4udmFsdWVdLmZpbHRlcigoW2tdKSA9PiBzdWJzZXQuaGFzKGspKS5tYXAoKFxuICAgICAgICAgICAgICAgICAgW2ssIHZdLFxuICAgICAgICAgICAgICAgICkgPT4gW2ssIHR5cGVvZiB2ID09PSBcIm9iamVjdFwiID8gZm4odiwgc3Vic2V0LmdldChrKSkgOiB2XSksXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gV2hlbiBib3RoIG9wZXJhbmRzIGFyZSBzZXQsIGJ1aWxkIGEgZmlsdGVyZWQgc2V0IHdpdGggY29tbW9uIHZhbHVlc1xuICAgICAgICAgICAgaWYgKCh2YWx1ZSBpbnN0YW5jZW9mIFNldCkgJiYgKHN1YnNldCBpbnN0YW5jZW9mIFNldCkpIHtcbiAgICAgICAgICAgICAgZmlsdGVyZWRba2V5XSA9IG5ldyBTZXQoWy4uLnZhbHVlXS5maWx0ZXIoKHYpID0+IHN1YnNldC5oYXModikpKTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gZm4odmFsdWUgYXMgbG9vc2UsIHN1YnNldCBhcyBsb29zZSk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZmlsdGVyZWRba2V5XSA9IHZhbHVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZpbHRlcmVkO1xuICAgIH1cbiAgfVxuICByZXR1cm4gYXNzZXJ0RXF1YWxzKFxuICAgIC8vIGdldCB0aGUgaW50ZXJzZWN0aW9uIG9mIFwiYWN0dWFsXCIgYW5kIFwiZXhwZWN0ZWRcIlxuICAgIC8vIHNpZGUgZWZmZWN0OiBhbGwgdGhlIGluc3RhbmNlcycgY29uc3RydWN0b3IgZmllbGQgaXMgXCJPYmplY3RcIiBub3cuXG4gICAgZmlsdGVyKGFjdHVhbCwgZXhwZWN0ZWQpLFxuICAgIC8vIHNldCAobmVzdGVkKSBpbnN0YW5jZXMnIGNvbnN0cnVjdG9yIGZpZWxkIHRvIGJlIFwiT2JqZWN0XCIgd2l0aG91dCBjaGFuZ2luZyBleHBlY3RlZCB2YWx1ZS5cbiAgICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2Rlbm9sYW5kL2Rlbm9fc3RkL3B1bGwvMTQxOVxuICAgIGZpbHRlcihleHBlY3RlZCwgZXhwZWN0ZWQpLFxuICApO1xufVxuXG4vKipcbiAqIEZvcmNlZnVsbHkgdGhyb3dzIGEgZmFpbGVkIGFzc2VydGlvblxuICovXG5leHBvcnQgZnVuY3Rpb24gZmFpbChtc2c/OiBzdHJpbmcpOiBuZXZlciB7XG4gIGFzc2VydChmYWxzZSwgYEZhaWxlZCBhc3NlcnRpb24ke21zZyA/IGA6ICR7bXNnfWAgOiBcIi5cIn1gKTtcbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGBlcnJvcmAgaXMgYW4gYEVycm9yYC5cbiAqIElmIG5vdCB0aGVuIGFuIGVycm9yIHdpbGwgYmUgdGhyb3duLlxuICogQW4gZXJyb3IgY2xhc3MgYW5kIGEgc3RyaW5nIHRoYXQgc2hvdWxkIGJlIGluY2x1ZGVkIGluIHRoZVxuICogZXJyb3IgbWVzc2FnZSBjYW4gYWxzbyBiZSBhc3NlcnRlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydElzRXJyb3I8RSBleHRlbmRzIEVycm9yID0gRXJyb3I+KFxuICBlcnJvcjogdW5rbm93bixcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgRXJyb3JDbGFzcz86IG5ldyAoLi4uYXJnczogYW55W10pID0+IEUsXG4gIG1zZ0luY2x1ZGVzPzogc3RyaW5nLFxuICBtc2c/OiBzdHJpbmcsXG4pOiBhc3NlcnRzIGVycm9yIGlzIEUge1xuICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA9PT0gZmFsc2UpIHtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoYEV4cGVjdGVkIFwiZXJyb3JcIiB0byBiZSBhbiBFcnJvciBvYmplY3QuYCk7XG4gIH1cbiAgaWYgKEVycm9yQ2xhc3MgJiYgIShlcnJvciBpbnN0YW5jZW9mIEVycm9yQ2xhc3MpKSB7XG4gICAgbXNnID0gYEV4cGVjdGVkIGVycm9yIHRvIGJlIGluc3RhbmNlIG9mIFwiJHtFcnJvckNsYXNzLm5hbWV9XCIsIGJ1dCB3YXMgXCIke1xuICAgICAgdHlwZW9mIGVycm9yID09PSBcIm9iamVjdFwiID8gZXJyb3I/LmNvbnN0cnVjdG9yPy5uYW1lIDogXCJbbm90IGFuIG9iamVjdF1cIlxuICAgIH1cIiR7bXNnID8gYDogJHttc2d9YCA6IFwiLlwifWA7XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbiAgaWYgKFxuICAgIG1zZ0luY2x1ZGVzICYmICghKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHx8XG4gICAgICAhc3RyaXBDb2xvcihlcnJvci5tZXNzYWdlKS5pbmNsdWRlcyhzdHJpcENvbG9yKG1zZ0luY2x1ZGVzKSkpXG4gICkge1xuICAgIG1zZyA9IGBFeHBlY3RlZCBlcnJvciBtZXNzYWdlIHRvIGluY2x1ZGUgXCIke21zZ0luY2x1ZGVzfVwiLCBidXQgZ290IFwiJHtcbiAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJbbm90IGFuIEVycm9yXVwiXG4gICAgfVwiJHttc2cgPyBgOiAke21zZ31gIDogXCIuXCJ9YDtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobXNnKTtcbiAgfVxufVxuXG4vKiogRXhlY3V0ZXMgYSBmdW5jdGlvbiwgZXhwZWN0aW5nIGl0IHRvIHRocm93LiBJZiBpdCBkb2VzIG5vdCwgdGhlbiBpdFxuICogdGhyb3dzLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFRocm93cyhcbiAgZm46ICgpID0+IHVua25vd24sXG4gIG1zZz86IHN0cmluZyxcbik6IHVua25vd247XG4vKiogRXhlY3V0ZXMgYSBmdW5jdGlvbiwgZXhwZWN0aW5nIGl0IHRvIHRocm93LiBJZiBpdCBkb2VzIG5vdCwgdGhlbiBpdFxuICogdGhyb3dzLiBBbiBlcnJvciBjbGFzcyBhbmQgYSBzdHJpbmcgdGhhdCBzaG91bGQgYmUgaW5jbHVkZWQgaW4gdGhlXG4gKiBlcnJvciBtZXNzYWdlIGNhbiBhbHNvIGJlIGFzc2VydGVkLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFRocm93czxFIGV4dGVuZHMgRXJyb3IgPSBFcnJvcj4oXG4gIGZuOiAoKSA9PiB1bmtub3duLFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBFcnJvckNsYXNzOiBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBFLFxuICBtc2dJbmNsdWRlcz86IHN0cmluZyxcbiAgbXNnPzogc3RyaW5nLFxuKTogRTtcbi8qKiBAZGVwcmVjYXRlZCAod2lsbCBiZSByZW1vdmVkIGFmdGVyIDAuMTU3LjApIFVzZSBhc3NlcnRUaHJvd3MoZm4sIG1zZykgaW5zdGVhZCwgd2hpY2ggbm93IHJldHVybnMgdGhyb3duXG4gKiB2YWx1ZSBhbmQgeW91IGNhbiBhc3NlcnQgb24gaXQuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0VGhyb3dzKFxuICBmbjogKCkgPT4gdW5rbm93bixcbiAgZXJyb3JDYWxsYmFjazogKGU6IEVycm9yKSA9PiB1bmtub3duLFxuICBtc2c/OiBzdHJpbmcsXG4pOiBFcnJvcjtcbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRUaHJvd3M8RSBleHRlbmRzIEVycm9yID0gRXJyb3I+KFxuICBmbjogKCkgPT4gdW5rbm93bixcbiAgZXJyb3JDbGFzc09yQ2FsbGJhY2tPck1zZz86XG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICB8IChuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBFKVxuICAgIHwgKChlOiBFcnJvcikgPT4gdW5rbm93bilcbiAgICB8IHN0cmluZyxcbiAgbXNnSW5jbHVkZXNPck1zZz86IHN0cmluZyxcbiAgbXNnPzogc3RyaW5nLFxuKTogRSB8IEVycm9yIHwgdW5rbm93biB7XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGxldCBFcnJvckNsYXNzOiAobmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gRSkgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIGxldCBtc2dJbmNsdWRlczogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICBsZXQgZXJyb3JDYWxsYmFjazogKChlOiBFcnJvcikgPT4gdW5rbm93bikgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIGxldCBlcnI7XG5cbiAgaWYgKHR5cGVvZiBlcnJvckNsYXNzT3JDYWxsYmFja09yTXNnICE9PSBcInN0cmluZ1wiKSB7XG4gICAgaWYgKFxuICAgICAgZXJyb3JDbGFzc09yQ2FsbGJhY2tPck1zZyA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICBlcnJvckNsYXNzT3JDYWxsYmFja09yTXNnLnByb3RvdHlwZSBpbnN0YW5jZW9mIEVycm9yIHx8XG4gICAgICBlcnJvckNsYXNzT3JDYWxsYmFja09yTXNnLnByb3RvdHlwZSA9PT0gRXJyb3IucHJvdG90eXBlXG4gICAgKSB7XG4gICAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgICAgRXJyb3JDbGFzcyA9IGVycm9yQ2xhc3NPckNhbGxiYWNrT3JNc2cgYXMgbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gRTtcbiAgICAgIG1zZ0luY2x1ZGVzID0gbXNnSW5jbHVkZXNPck1zZztcbiAgICB9IGVsc2Uge1xuICAgICAgZXJyb3JDYWxsYmFjayA9IGVycm9yQ2xhc3NPckNhbGxiYWNrT3JNc2cgYXMgKGU6IEVycm9yKSA9PiB1bmtub3duO1xuICAgICAgbXNnID0gbXNnSW5jbHVkZXNPck1zZztcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgbXNnID0gZXJyb3JDbGFzc09yQ2FsbGJhY2tPck1zZztcbiAgfVxuICBsZXQgZG9lc1Rocm93ID0gZmFsc2U7XG4gIGNvbnN0IG1zZ1RvQXBwZW5kVG9FcnJvciA9IG1zZyA/IGA6ICR7bXNnfWAgOiBcIi5cIjtcbiAgdHJ5IHtcbiAgICBmbigpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChFcnJvckNsYXNzIHx8IGVycm9yQ2FsbGJhY2spIHtcbiAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yID09PSBmYWxzZSkge1xuICAgICAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXCJBIG5vbi1FcnJvciBvYmplY3Qgd2FzIHRocm93bi5cIik7XG4gICAgICB9XG4gICAgICBhc3NlcnRJc0Vycm9yKFxuICAgICAgICBlcnJvcixcbiAgICAgICAgRXJyb3JDbGFzcyxcbiAgICAgICAgbXNnSW5jbHVkZXMsXG4gICAgICAgIG1zZyxcbiAgICAgICk7XG4gICAgICBpZiAodHlwZW9mIGVycm9yQ2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICBlcnJvckNhbGxiYWNrKGVycm9yKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZXJyID0gZXJyb3I7XG4gICAgZG9lc1Rocm93ID0gdHJ1ZTtcbiAgfVxuICBpZiAoIWRvZXNUaHJvdykge1xuICAgIG1zZyA9IGBFeHBlY3RlZCBmdW5jdGlvbiB0byB0aHJvdyR7bXNnVG9BcHBlbmRUb0Vycm9yfWA7XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbiAgcmV0dXJuIGVycjtcbn1cblxuLyoqIEV4ZWN1dGVzIGEgZnVuY3Rpb24gd2hpY2ggcmV0dXJucyBhIHByb21pc2UsIGV4cGVjdGluZyBpdCB0byByZWplY3QuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0UmVqZWN0cyhcbiAgZm46ICgpID0+IFByb21pc2VMaWtlPHVua25vd24+LFxuICBtc2c/OiBzdHJpbmcsXG4pOiBQcm9taXNlPHVua25vd24+O1xuLyoqIEV4ZWN1dGVzIGEgZnVuY3Rpb24gd2hpY2ggcmV0dXJucyBhIHByb21pc2UsIGV4cGVjdGluZyBpdCB0byByZWplY3QuXG4gKiBJZiBpdCBkb2VzIG5vdCwgdGhlbiBpdCB0aHJvd3MuIEFuIGVycm9yIGNsYXNzIGFuZCBhIHN0cmluZyB0aGF0IHNob3VsZCBiZVxuICogaW5jbHVkZWQgaW4gdGhlIGVycm9yIG1lc3NhZ2UgY2FuIGFsc28gYmUgYXNzZXJ0ZWQuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0UmVqZWN0czxFIGV4dGVuZHMgRXJyb3IgPSBFcnJvcj4oXG4gIGZuOiAoKSA9PiBQcm9taXNlTGlrZTx1bmtub3duPixcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgRXJyb3JDbGFzczogbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gRSxcbiAgbXNnSW5jbHVkZXM/OiBzdHJpbmcsXG4gIG1zZz86IHN0cmluZyxcbik6IFByb21pc2U8RT47XG4vKiogQGRlcHJlY2F0ZWQgKHdpbGwgYmUgcmVtb3ZlZCBhZnRlciAwLjE1Ny4wKSBVc2UgYXNzZXJ0UmVqZWN0cyhmbiwgbXNnKSBpbnN0ZWFkLCB3aGljaCBub3cgcmV0dXJucyByZWplY3RlZCB2YWx1ZVxuICogYW5kIHlvdSBjYW4gYXNzZXJ0IG9uIGl0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFJlamVjdHMoXG4gIGZuOiAoKSA9PiBQcm9taXNlTGlrZTx1bmtub3duPixcbiAgZXJyb3JDYWxsYmFjazogKGU6IEVycm9yKSA9PiB1bmtub3duLFxuICBtc2c/OiBzdHJpbmcsXG4pOiBQcm9taXNlPEVycm9yPjtcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhc3NlcnRSZWplY3RzPEUgZXh0ZW5kcyBFcnJvciA9IEVycm9yPihcbiAgZm46ICgpID0+IFByb21pc2VMaWtlPHVua25vd24+LFxuICBlcnJvckNsYXNzT3JDYWxsYmFja09yTXNnPzpcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIHwgKG5ldyAoLi4uYXJnczogYW55W10pID0+IEUpXG4gICAgfCAoKGU6IEVycm9yKSA9PiB1bmtub3duKVxuICAgIHwgc3RyaW5nLFxuICBtc2dJbmNsdWRlc09yTXNnPzogc3RyaW5nLFxuICBtc2c/OiBzdHJpbmcsXG4pOiBQcm9taXNlPEUgfCBFcnJvciB8IHVua25vd24+IHtcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgbGV0IEVycm9yQ2xhc3M6IChuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBFKSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgbGV0IG1zZ0luY2x1ZGVzOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIGxldCBlcnJvckNhbGxiYWNrOiAoKGU6IEVycm9yKSA9PiB1bmtub3duKSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgbGV0IGVycjtcblxuICBpZiAodHlwZW9mIGVycm9yQ2xhc3NPckNhbGxiYWNrT3JNc2cgIT09IFwic3RyaW5nXCIpIHtcbiAgICBpZiAoXG4gICAgICBlcnJvckNsYXNzT3JDYWxsYmFja09yTXNnID09PSB1bmRlZmluZWQgfHxcbiAgICAgIGVycm9yQ2xhc3NPckNhbGxiYWNrT3JNc2cucHJvdG90eXBlIGluc3RhbmNlb2YgRXJyb3IgfHxcbiAgICAgIGVycm9yQ2xhc3NPckNhbGxiYWNrT3JNc2cucHJvdG90eXBlID09PSBFcnJvci5wcm90b3R5cGVcbiAgICApIHtcbiAgICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgICBFcnJvckNsYXNzID0gZXJyb3JDbGFzc09yQ2FsbGJhY2tPck1zZyBhcyBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBFO1xuICAgICAgbXNnSW5jbHVkZXMgPSBtc2dJbmNsdWRlc09yTXNnO1xuICAgIH0gZWxzZSB7XG4gICAgICBlcnJvckNhbGxiYWNrID0gZXJyb3JDbGFzc09yQ2FsbGJhY2tPck1zZyBhcyAoZTogRXJyb3IpID0+IHVua25vd247XG4gICAgICBtc2cgPSBtc2dJbmNsdWRlc09yTXNnO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBtc2cgPSBlcnJvckNsYXNzT3JDYWxsYmFja09yTXNnO1xuICB9XG4gIGxldCBkb2VzVGhyb3cgPSBmYWxzZTtcbiAgbGV0IGlzUHJvbWlzZVJldHVybmVkID0gZmFsc2U7XG4gIGNvbnN0IG1zZ1RvQXBwZW5kVG9FcnJvciA9IG1zZyA/IGA6ICR7bXNnfWAgOiBcIi5cIjtcbiAgdHJ5IHtcbiAgICBjb25zdCBwb3NzaWJsZVByb21pc2UgPSBmbigpO1xuICAgIGlmIChcbiAgICAgIHBvc3NpYmxlUHJvbWlzZSAmJlxuICAgICAgdHlwZW9mIHBvc3NpYmxlUHJvbWlzZSA9PT0gXCJvYmplY3RcIiAmJlxuICAgICAgdHlwZW9mIHBvc3NpYmxlUHJvbWlzZS50aGVuID09PSBcImZ1bmN0aW9uXCJcbiAgICApIHtcbiAgICAgIGlzUHJvbWlzZVJldHVybmVkID0gdHJ1ZTtcbiAgICAgIGF3YWl0IHBvc3NpYmxlUHJvbWlzZTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKCFpc1Byb21pc2VSZXR1cm5lZCkge1xuICAgICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKFxuICAgICAgICBgRnVuY3Rpb24gdGhyb3dzIHdoZW4gZXhwZWN0ZWQgdG8gcmVqZWN0JHttc2dUb0FwcGVuZFRvRXJyb3J9YCxcbiAgICAgICk7XG4gICAgfVxuICAgIGlmIChFcnJvckNsYXNzIHx8IGVycm9yQ2FsbGJhY2spIHtcbiAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yID09PSBmYWxzZSkge1xuICAgICAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXCJBIG5vbi1FcnJvciBvYmplY3Qgd2FzIHJlamVjdGVkLlwiKTtcbiAgICAgIH1cbiAgICAgIGFzc2VydElzRXJyb3IoXG4gICAgICAgIGVycm9yLFxuICAgICAgICBFcnJvckNsYXNzLFxuICAgICAgICBtc2dJbmNsdWRlcyxcbiAgICAgICAgbXNnLFxuICAgICAgKTtcbiAgICAgIGlmICh0eXBlb2YgZXJyb3JDYWxsYmFjayA9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgZXJyb3JDYWxsYmFjayhlcnJvcik7XG4gICAgICB9XG4gICAgfVxuICAgIGVyciA9IGVycm9yO1xuICAgIGRvZXNUaHJvdyA9IHRydWU7XG4gIH1cbiAgaWYgKCFkb2VzVGhyb3cpIHtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXG4gICAgICBgRXhwZWN0ZWQgZnVuY3Rpb24gdG8gcmVqZWN0JHttc2dUb0FwcGVuZFRvRXJyb3J9YCxcbiAgICApO1xuICB9XG4gIHJldHVybiBlcnI7XG59XG5cbi8qKiBVc2UgdGhpcyB0byBzdHViIG91dCBtZXRob2RzIHRoYXQgd2lsbCB0aHJvdyB3aGVuIGludm9rZWQuICovXG5leHBvcnQgZnVuY3Rpb24gdW5pbXBsZW1lbnRlZChtc2c/OiBzdHJpbmcpOiBuZXZlciB7XG4gIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cgfHwgXCJ1bmltcGxlbWVudGVkXCIpO1xufVxuXG4vKiogVXNlIHRoaXMgdG8gYXNzZXJ0IHVucmVhY2hhYmxlIGNvZGUuICovXG5leHBvcnQgZnVuY3Rpb24gdW5yZWFjaGFibGUoKTogbmV2ZXIge1xuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXCJ1bnJlYWNoYWJsZVwiKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFFMUU7Ozs7OztHQU1HLENBRUgsU0FBUyxHQUFHLEVBQUUsVUFBVSxRQUFRLGtCQUFrQixDQUFDO0FBQ25ELFNBQVMsWUFBWSxFQUFFLElBQUksRUFBRSxPQUFPLFFBQVEsWUFBWSxDQUFDO0FBQ3pELFNBQVMsTUFBTSxRQUFRLGNBQWMsQ0FBQztBQUV0QyxNQUFNLGVBQWUsR0FBRyxrQkFBa0IsQUFBQztBQUUzQyxPQUFPLE1BQU0sY0FBYyxTQUFTLEtBQUs7SUFDdkMsQUFB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