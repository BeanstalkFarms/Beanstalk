import {
  BEANFT_BARNRAISE_ADDRESSES,
  BEANFT_GENESIS_ADDRESSES,
  BEANFT_WINTER_ADDRESSES,
  BEANFT_BASIN_ADDRESSES,
} from '~/constants';

export enum ClaimStatus {
  CLAIMED = 0,
  UNCLAIMED = 1,
}

export type Nft = {
  /** The BeaNFT number (eg: BeaNFT 1634 */
  id: number;
  /** ETH address of owner. */
  account: string;
  /** Winter or Genesis */
  subcollection: string;
  /** */
  imageIpfsHash?: string;
  /** 0 => claimed, 1 => unclaimed  */
  claimed?: ClaimStatus;

  // genesis only
  metadataIpfsHash?: string;
  signature?: string;

  // winter and genesis
  signature2?: string;
};

/** Maps an NFT collection to its ETH address. */
export const COLLECTION_ADDRESS: { [c: string]: string } = {
  Genesis: BEANFT_GENESIS_ADDRESSES[1],
  Winter: BEANFT_WINTER_ADDRESSES[1],
  BarnRaise: BEANFT_BARNRAISE_ADDRESSES[1],
  Basin: BEANFT_BASIN_ADDRESSES[1],
};

export const ADDRESS_COLLECTION: { [c: string]: string } = {
  [BEANFT_GENESIS_ADDRESSES[1]]: COLLECTION_ADDRESS.Genesis,
  [BEANFT_WINTER_ADDRESSES[1]]: COLLECTION_ADDRESS.Winter,
  [BEANFT_BARNRAISE_ADDRESSES[1]]: COLLECTION_ADDRESS.BarnRaise,
  [BEANFT_BASIN_ADDRESSES[1]]: COLLECTION_ADDRESS.Basin,
};

export async function loadNFTs(account: string) {
  const genesisNFTs: Nft[] = [];
  const winterNFTs: Nft[] = [];
  const barnRaiseNFTs: Nft[] = [];
  const basinNFTs: Nft[] = [];

  // BeaNFT subgraph has been removed; returning empty data.

  return {
    genesis: genesisNFTs,
    winter: winterNFTs,
    barnRaise: barnRaiseNFTs,
    basin: basinNFTs,
  };
}
