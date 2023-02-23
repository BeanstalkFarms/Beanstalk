/* eslint-disable no-redeclare */
import React, { useEffect } from 'react';
import { MayPromise } from '~/types';

import useDeepCompareMemoize from './useDeepCompareMemoize';

type UseEffectParams = Parameters<typeof React.useEffect>;
type EffectCallback = () => MayPromise<void>;
type DependencyList = UseEffectParams[1];

const isFunction = (value: any) => typeof value === 'function';

function useDeepCompareEffect(effect: EffectCallback, dependencies?: DependencyList): void;
function useDeepCompareEffect(
  effect: EffectCallback,
  cleanFunction: () => void,
  dependencies: DependencyList
): void;
function useDeepCompareEffect(effect: EffectCallback, param2?: any, param3?: any): void {
  const cleanFunction = isFunction(param2) ? param2 : undefined;

  useEffect(() => {
    effect();
    return cleanFunction;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, useDeepCompareMemoize(isFunction(param2) ? param3 : param2));
}

export default useDeepCompareEffect;
