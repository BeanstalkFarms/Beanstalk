import { ApolloQueryResult } from '@apollo/client';
import { useMemo } from 'react';

/* <
  Q extends ApolloQueryResult<any>,
  K extends keyof Q['data'],
  O
> */

export default function useCastApolloQuery<T>(
  query: ApolloQueryResult<any>,
  key: string,
  cast: (elem: any) => T,
  skip?: boolean,
) {
  return useMemo<T[] | undefined>(() => {
    if (skip || query.loading || !query.data?.[key]) return undefined;
    return query.data[key].map(cast);
  }, [
    query.data, 
    query.loading,
    cast,
    key,
    skip
  ]);
}
