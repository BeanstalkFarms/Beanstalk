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

// BeaNFT GraphQL endpoint no longer exists; hook returns empty data.
export default function useFarmerBeaNFTs(
  _addresses?: string[],
  _skip?: boolean
) {
  useAccount(); // keep signature compatible

  return {
    data: {} as { [farmerAddress: string]: FarmerBeaNFTsMap },
    loading: false,
    error: undefined,
    refetch: () => Promise.resolve(undefined),
  };
}
