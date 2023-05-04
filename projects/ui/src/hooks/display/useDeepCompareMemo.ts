import React, { useMemo } from 'react';
import useDeepCompareMemoize from './useDeepCompareMemoize';
import { IS_DEV_ENV } from '~/util';

const checkDeps = (deps: React.DependencyList) => {
  if (!deps || deps.length === 0) {
    throw new Error(
      'useDeepCompareMemo should not be used with no dependencies. Use useMemo instead.'
    );
  }
};

export default function useDeepCompareMemo<T>(
  callback: () => T,
  dependencies: React.DependencyList
) {
  if (IS_DEV_ENV) checkDeps(dependencies);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(callback, useDeepCompareMemoize(dependencies));
}
