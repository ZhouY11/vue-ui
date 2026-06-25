const { hasOwnProperty, toString: objectToString } = Object.prototype;

export const hasOwn = (val: object, key: string | symbol): key is keyof typeof val =>
  val !== null && hasOwnProperty.call(val, key);

export const { isArray } = Array;

export const isFunction = (val: unknown): val is Function => typeof val === 'function';

export const isString = (val: unknown): val is string => typeof val === 'string';

export const isNumber = (val: unknown): val is number => typeof val === 'number';

export const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol';

export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === 'object';

export const isPromise = <T = any>(val: unknown): val is Promise<T> => {
  return (
    (isObject(val) || isFunction(val)) &&
    isFunction((val as any).then) &&
    isFunction((val as any).catch)
  );
};

export const toTypeString = (value: unknown): string => objectToString.call(value);

export const toRawType = (value: unknown): string => toTypeString(value).slice(8, -1);

export const isMap = (val: unknown): val is Map<any, any> => toTypeString(val) === '[object Map]';

export const isDate = (val: unknown): val is Date => toTypeString(val) === '[object Date]';

export function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function isNotNullish<T>(value: T): value is NonNullable<T> {
  return !isNullish(value);
}

export const isOn = (key: string): boolean =>
  key.charCodeAt(0) === 111 /* o */ &&
  key.charCodeAt(1) === 110 /* n */ &&
  // uppercase letter
  (key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97);

export const isModelListener = (key: string): key is `onUpdate:${string}` =>
  key.startsWith('onUpdate:');

/**
 * ARIA attributes whose values are IDREF / IDREF-list like tokens and can be merged.
 * Do NOT merge all aria-* props blindly.
 */
export const MERGEABLE_ARIA_IDREF_LIST_PROPS = new Set([
  'aria-describedby',
  'aria-labelledby',
  'aria-controls',
  'aria-owns',
  'aria-flowto'
]);
export const isMergeableAria = (key: string): boolean => {
  return typeof key === 'string' && MERGEABLE_ARIA_IDREF_LIST_PROPS.has(key);
};
