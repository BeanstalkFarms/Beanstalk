import { useBeaNftUsersQuery } from '~/generated/graphql';
import useAccount from '../ledger/useAccount';

export enum BeaNFTCollection {
  GENESIS = 'genesis',
  WINTER = 'winter',
  BARN_RAISE = 'barnRaise',
}

export type FarmerBeaNFTsMap = {
  [key in BeaNFTCollection]: {
    /// NFT IDs that have been minted
    ids: number[];
  };
};

const parseBeaNFTsResult = (_data: ReturnType<typeof useBeaNftUsersQuery>) => {
  const data = _data.data?.beaNFTUsers || [];
  return data.reduce<{
    [farmerAddress: string]: FarmerBeaNFTsMap;
  }>((acc, curr) => {
    const account = curr.id;

    acc[account] = {
      [BeaNFTCollection.BARN_RAISE]: {
        ids: curr.barnRaise || [],
      },
      [BeaNFTCollection.WINTER]: {
        ids: curr.winter || [],
      },
      [BeaNFTCollection.GENESIS]: {
        ids: curr.genesis || [],
      },
    };

    return acc;
  }, {});
};

export default function useFarmerBeaNFTs(
  _addresses?: string[],
  skip?: boolean
) {
  const account = useAccount();

  const addresses = _addresses || (account ? [account] : undefined);

  const query = useBeaNftUsersQuery({
    variables: {
      id_in: addresses,
    },
    context: {
      subgraph: 'beanft',
    },
    fetchPolicy: 'cache-and-network',
    skip: !addresses || !addresses.length || skip,
  });

  const parsedNFTData = parseBeaNFTsResult(query);

  return {
    data: parsedNFTData,
    loading: query.loading,
    error: query.error,
    refetch: query.refetch,
  };
}
