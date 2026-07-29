/**
 * Ported from `@airtable/blocks-testing` v1 `src/private_utils.ts`, plus
 * `setGlobalConfigValue` which lived in v1's `mock_airtable_interface.ts`.
 */
import {type GlobalConfigArray, type GlobalConfigObject, type GlobalConfigValue} from './sdk_types';

/**
 * An object map with a dynamic key type. Alias for TypeScript's `Record`,
 * renamed because "record" is confusing in the Airtable domain.
 *
 * @hidden
 */
export type ObjectMap<K extends keyof any, V> = {[P in K]: V};

/** @hidden */
export function cloneDeep<T>(obj: T): T {
    const jsonString = JSON.stringify(obj);
    if (jsonString === undefined) {
        return obj;
    }
    return JSON.parse(jsonString);
}

/** @hidden */
export function has<T extends object>(obj: T, key: keyof any): key is keyof T {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

/** @hidden */
export function keyBy<Item, Key extends string>(
    array: ReadonlyArray<Item>,
    getKey: (arg1: Item) => Key,
): ObjectMap<Key, Item> {
    const result = {} as ObjectMap<Key, Item>;
    for (const item of array) {
        result[getKey(item)] = item;
    }
    return result;
}

/** @hidden */
export function getId({id}: {id: string}) {
    return id;
}

const alphanumerics = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Select a random element from an array-like object. @internal */
function pick<T>(arraylike: {[key: number]: T; length: number}): T {
    return arraylike[Math.floor(Math.random() * arraylike.length)];
}

/**
 * Generate a random Airtable-shaped identifier with the given prefix, e.g.
 * `generateId('rec')`.
 *
 * @internal
 */
export function generateId(prefix: string): string {
    const length = 17 - prefix.length;
    return (
        prefix +
        Array.from({length}, () => pick(alphanumerics)).join('')
    );
}

function isReadonlyArray(value: any): value is ReadonlyArray<any> {
    return Array.isArray(value);
}

const FORBIDDEN_GLOBAL_CONFIG_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Immutably set (or, with `value === undefined`, delete) a deep path in a
 * globalConfig-style key-value store. Rejects prototype-polluting keys
 * (CWE-1321) — see .claude/rules/security.md.
 *
 * @internal
 */
export function setGlobalConfigValue(
    target: GlobalConfigValue,
    path: ReadonlyArray<string>,
    value: GlobalConfigValue | undefined,
): GlobalConfigObject | GlobalConfigArray {
    if (typeof path[0] === 'string' && FORBIDDEN_GLOBAL_CONFIG_KEYS.has(path[0])) {
        throw new Error(`Invalid globalConfig path segment: ${path[0]}`);
    }
    if (isReadonlyArray(target)) {
        const newTarget = target.slice();
        const index = parseInt(path[0], 10);

        if (path.length === 1) {
            if (value === undefined) {
                newTarget.splice(index, 1);
            } else {
                newTarget[index] = value;
            }
        } else {
            newTarget[index] = setGlobalConfigValue(target[index] || {}, path.slice(1), value);
        }
        return newTarget;
    }
    const newTarget: GlobalConfigObject = typeof target === 'object' && target !== null ? {...(target as GlobalConfigObject)} : {};

    if (path.length === 1) {
        if (value === undefined) {
            delete newTarget[path[0]];
        } else {
            newTarget[path[0]] = value;
        }
    } else {
        newTarget[path[0]] = setGlobalConfigValue(newTarget[path[0]] || {}, path.slice(1), value);
    }
    return newTarget;
}
