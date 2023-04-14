import { useCallback } from 'react';
import useAccount from '~/hooks/ledger/useAccount';

export default function useAppFlag<T extends string | number | object>(
  id: string,
  parse: 'string' | 'int' | ((v: string) => T) = 'string',
  fallback?: T
) {
  const account = useAccount();
  const key = `beanstalk.a.${account || '_'}.${id}`;  
  const get = useCallback<() => T>(() => {
    try {
      const v = localStorage.getItem(key);
      if (!v) {
        if (fallback !== undefined) return fallback;
        throw new Error('no fallback');
      }
      if (parse === 'string') return v as T;
      if (parse === 'int') return parseInt(v, 10) as T;
      return parse(v) as T;
    } catch (e) {
      if (fallback) return fallback as T;
      throw e;
    }
  }, [fallback, key, parse]);
  const set = useCallback((v: T) => {
    localStorage.setItem(key, v.toString());
  }, [key]);
  return [get, set, key] as const;
}
