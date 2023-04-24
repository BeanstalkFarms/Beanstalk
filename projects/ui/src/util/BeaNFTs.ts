import { BEANFT_BARNRAISE_ADDRESSES, BEANFT_GENESIS_ADDRESSES, BEANFT_WINTER_ADDRESSES } from '~/constants';

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
  Winter:  BEANFT_WINTER_ADDRESSES[1],
  BarnRaise: BEANFT_BARNRAISE_ADDRESSES[1],
};

export const ADDRESS_COLLECTION: {[c: string]: string} = {
  [BEANFT_GENESIS_ADDRESSES[1]]: COLLECTION_ADDRESS.Genesis,
  [BEANFT_WINTER_ADDRESSES[1]]: COLLECTION_ADDRESS.Winter,
  [BEANFT_BARNRAISE_ADDRESSES[1]]: COLLECTION_ADDRESS.BarnRaise,
};

export async function loadNFTs(account: string) {

  const genesisNFTs: Nft[] = []
  const winterNFTs: Nft[] = []
  const barnRaiseNFTs: Nft[] = []

  try {

    const ownedNFTs = await fetch('https://graph.node.bean.money/subgraphs/name/beanft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
            query NFTData($account: ID!) {
              user(id: $account) {
                id
                genesis
                barnRaise
                winter
              }
            }
          `,
        variables: {
          account: account.toLowerCase(),
        },
      })
    })

    const ownedNFTsJSON = await ownedNFTs.json()

    ownedNFTsJSON.data.user.genesis.sort()
    ownedNFTsJSON.data.user.winter.sort()
    ownedNFTsJSON.data.user.barnRaise.sort()

    ownedNFTsJSON.data.user.genesis.forEach((element: number) => {
      genesisNFTs.push(
        {
          id: element,
          account: account.toLowerCase(),
          subcollection: "Genesis"
        }
      )
    });

    ownedNFTsJSON.data.user.winter.forEach((element: number) => {
      winterNFTs.push(
        {
          id: element,
          account: account.toLowerCase(),
          subcollection: "Winter"
        }
      )
    });

    ownedNFTsJSON.data.user.barnRaise.forEach((element: number) => {
      barnRaiseNFTs.push(
        {
          id: element,
          account: account.toLowerCase(),
          subcollection: "Barn Raise"
        }
      )
    }); } catch (e) {
    console.log("BEANFT - ERROR FETCHING DATA FROM SUBGRAPH - ", e)
  }

  return {
    genesis: genesisNFTs,
    winter: winterNFTs,
    barnRaise: barnRaiseNFTs,
  };
}
