import React, { useCallback, useEffect, useMemo, useState } from 'react';

export default function useAsyncMemo<T>(
  asyncCallback: () => Promise<T>,
  deps: React.DependencyList
) {
  const [state, setState] = useState<T | undefined>(undefined);

  useEffect(() => {
    asyncCallback()
      .then(setState)
      .catch(() => setState(undefined));
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

  return useMemo(() => [state, refetch] as const, [refetch, state]);
}
