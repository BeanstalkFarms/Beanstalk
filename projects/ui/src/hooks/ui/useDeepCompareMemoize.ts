import React, { useRef } from 'react';
import _ from 'lodash';

const isDeepEqual = (prev: any, curr: any) => _.isEqual(prev, curr);

export default function useDeepCompareMemoize(value: React.DependencyList) {
  const ref = useRef<React.DependencyList>([]);
  const signalRef = useRef<number>(0);

  if (!isDeepEqual(value, ref.current)) {
    ref.current = value;
    signalRef.current += 1;
  }

  return ref.current;
}
