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

  try {
    const ownedNFTs = await fetch(
      'https://graph.node.bean.money/subgraphs/name/beanft-dev',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query NFTData($account: ID!) {
              beaNFTUser(id: $account) {
                id
                genesis
                barnRaise
                winter
                basin
              }
            }
          `,
          variables: {
            account: account.toLowerCase(),
          },
        }),
      }
    );

    const ownedNFTsJSON = await ownedNFTs.json();

    if (ownedNFTsJSON.data.beaNFTUser) {
      if (ownedNFTsJSON.data.beaNFTUser.genesis) {
        ownedNFTsJSON.data.beaNFTUser.genesis.sort();
        ownedNFTsJSON.data.beaNFTUser.genesis.forEach((element: number) => {
          genesisNFTs.push({
            id: element,
            account: account.toLowerCase(),
            subcollection: 'Genesis',
          });
        });
      }

      if (ownedNFTsJSON.data.beaNFTUser.winter) {
        ownedNFTsJSON.data.beaNFTUser.winter.sort();
        ownedNFTsJSON.data.beaNFTUser.winter.forEach((element: number) => {
          winterNFTs.push({
            id: element,
            account: account.toLowerCase(),
            subcollection: 'Winter',
          });
        });
      }

      if (ownedNFTsJSON.data.beaNFTUser.barnRaise) {
        ownedNFTsJSON.data.beaNFTUser.barnRaise.sort();
        ownedNFTsJSON.data.beaNFTUser.barnRaise.forEach((element: number) => {
          barnRaiseNFTs.push({
            id: element,
            account: account.toLowerCase(),
            subcollection: 'Barn Raise',
          });
        });
      }

      if (ownedNFTsJSON.data.beaNFTUser.basin) {
        ownedNFTsJSON.data.beaNFTUser.basin.sort();
        ownedNFTsJSON.data.beaNFTUser.basin.forEach((element: number) => {
          basinNFTs.push({
            id: element,
            account: account.toLowerCase(),
            subcollection: 'Basin',
          });
        });
      }
    }
  } catch (e) {
    console.error(e)
  }

  return {
    genesis: genesisNFTs,
    winter: winterNFTs,
    barnRaise: barnRaiseNFTs,
    basin: basinNFTs,
  };
}
