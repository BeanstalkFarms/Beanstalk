import { useState, useEffect, useRef, useMemo } from 'react';
import { debounce } from 'lodash';
import { exists } from '~/util';

type AddressIsh = { address: string };
type ToStringIsh = { toString: () => string };
type ToHumanIsh = { toHuman: () => string };

interface DebounceOptions<T> {
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
  equalityFn?: (left: T, right: T) => boolean;
}

function defaultEqualityFn<T = unknown>(left: T, right: T): boolean {
  return left === right;
}
function addressIshEqualityFn(left: unknown, right: unknown): boolean {
  return (
    (left as AddressIsh).address.toLowerCase() ===
    (right as AddressIsh).address.toLowerCase()
  );
}
function toStringIshEqualityFn(left: unknown, right: unknown): boolean {
  return (left as ToStringIsh).toString() === (right as ToStringIsh).toString();
}
function toHumanIshEqualityFn(left: unknown, right: unknown): boolean {
  return (left as ToHumanIsh).toHuman() === (right as ToHumanIsh).toHuman();
}

const getDefaultEqualityFn = <T>(
  value: T
): ((left: T, right: T) => boolean) => {
  if (exists(value)) {
    if (typeof value === 'object') {
      if ('address' in value) {
        return addressIshEqualityFn;
      }
      if ('toString' in value && typeof value.toString === 'function') {
        return toStringIshEqualityFn;
      }
      if ('toHuman' in value && typeof value.toHuman === 'function') {
        return toHumanIshEqualityFn;
      }
    }
  }
  return defaultEqualityFn;
};

/**
 * Debounces a value, updating the debounced value when the input value changes.
 * @param value - The value to debounce.
 * @param delay - The delay in milliseconds.
 * @param options - Options for the debounce function.
 * - `leading`: Whether to invoke the debounced function on the leading edge of the timeout.
 * - `trailing`: Whether to invoke the debounced function on the trailing edge of the timeout.
 * - `maxWait`: The maximum time to wait before invoking the debounced function.
 * - `equalityFn`: A function to determine if two values are equal. Important to memoize this.
 * @returns The debounced value.
 */
function useDebounce<T>(
  value: T,
  delay: number = 250,
  options: DebounceOptions<T> = {}
): T {
  const {
    leading = false,
    trailing = true,
    maxWait,
    equalityFn = getDefaultEqualityFn(value),
  } = options;

  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const previousValueRef = useRef<T>(value);

  const debouncedFn = useMemo(() => {
    const fn = debounce(
      (newValue: T) => {
        setDebouncedValue(newValue);
      },
      delay,
      { leading, trailing, maxWait }
    );

    return fn;
  }, [delay, leading, trailing, maxWait]);

  useEffect(() => {
    if (!equalityFn(previousValueRef.current, value)) {
      previousValueRef.current = value;
      debouncedFn(value);

      if (leading) {
        setDebouncedValue(value);
      }
    }

    return () => {
      debouncedFn.cancel();
    };
  }, [value, debouncedFn, equalityFn, leading]);

  return debouncedValue;
}

export default useDebounce;
