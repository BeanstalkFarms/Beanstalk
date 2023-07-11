import React, { useCallback, useEffect, useMemo, useState } from 'react';

export default function useAsyncMemo<T>(
  asyncCallback: () => Promise<T>,
  deps: React.DependencyList
) {
  const [state, setState] = useState<T | undefined>(undefined);
  const memoizedState = useMemo(() => state, [state]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        const result = await asyncCallback();
        if (isMounted) {
          setState(result);
        }
      } catch (e) {
        console.error(e);
        setState(undefined);
      }
    };

    run();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refetch = useCallback(async () => {
    try {
      const result = await asyncCallback();
      setState(result);
    } catch (e) {
      setState(undefined);
    }
  }, [asyncCallback]);

  return useMemo(
    () => [memoizedState, refetch] as const,
    [refetch, memoizedState]
  );
}
