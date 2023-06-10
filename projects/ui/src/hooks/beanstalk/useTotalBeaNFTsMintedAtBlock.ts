import { gql, useQuery } from '@apollo/client';
import BigNumber from 'bignumber.js';
import { useMemo } from 'react';

/// We already have a query for this (~/components/NFT/queries/BeaNFTCollections.graphql)
/// but it has different parameters, so we make a new one.
function useBeanNFTsMintedByBlockQuery(
  blockNumber?: number,
  options?: { skip?: boolean }
) {
  return useQuery(
    gql`
      query BeaNFTCollections($blockNumber: Int) {
        collectionDatas(block: { number: $blockNumber }) {
          id
          minted
        }
      }
    `,
    {
      variables: { blockNumber },
      context: { subgraph: 'beanft' },
      fetchPolicy: 'network-only',
      nextFetchPolicy: 'cache-only',
      skip: options?.skip || !blockNumber,
    }
  );
}

export default function useTotalBeaNFTsMintedAtBlock(
  ...params: Parameters<typeof useBeanNFTsMintedByBlockQuery>
) {
  const query = useBeanNFTsMintedByBlockQuery(...params);

  const total = useMemo(() => {
    if (!query.data?.collectionDatas) return undefined;
    const collectionDatas = Object.values(query.data.collectionDatas);
    const _ttl = collectionDatas.reduce<number>((memo, next) => {
      const data = next as {
        id: string;
        minted: number[];
      };

      return memo + (data.minted.length || 0);
    }, 0);

    return new BigNumber(_ttl);
  }, [query.data]);

  return [total, query.loading] as const;
}
