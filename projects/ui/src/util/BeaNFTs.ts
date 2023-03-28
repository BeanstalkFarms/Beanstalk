import { BEANFT_GENESIS_ADDRESSES, BEANFT_WINTER_ADDRESSES } from '~/constants';

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
  signature2?: string
}

/** Maps an NFT collection to its ETH address. */
export const COLLECTION_ADDRESS: {[c: string]: string} = {
  Genesis: BEANFT_GENESIS_ADDRESSES[1],
  Winter:  BEANFT_WINTER_ADDRESSES[1]
};

export const ADDRESS_COLLECTION: {[c: string]: string} = {
  [BEANFT_GENESIS_ADDRESSES[1]]: COLLECTION_ADDRESS.Genesis,
  [BEANFT_WINTER_ADDRESSES[1]]: COLLECTION_ADDRESS.Winter
};

export async function loadNFTs(account: string) {
  const nftData : Nft[] = await fetch(`/.netlify/functions/nfts?account=${account}`).then((response) => response.json());
  
  if (nftData.length === 0) {
    return {
      genesis: [],
      winter: [],
    };
  }

  const genesisNFTs = nftData.filter((n) => n.subcollection === 'Genesis');
  const winterNFTs  = nftData.filter((n) => n.subcollection === 'Winter');

  return {
    genesis: genesisNFTs,
    winter: winterNFTs,
  };
}
