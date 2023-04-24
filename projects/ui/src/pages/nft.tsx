import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Card, Container, Stack, Tab, Tabs, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSigner } from '~/hooks/ledger/useSigner';
import useTabs from '~/hooks/display/useTabs';
import { getAccount } from '~/util/Account';
import { ADDRESS_COLLECTION, ClaimStatus, loadNFTs, Nft } from '~/util/BeaNFTs';
import NFTDialog from '~/components/NFT/NFTDialog';
import { BEANFT_GENESIS_ADDRESSES, BEANFT_WINTER_ADDRESSES, BEANFT_BARNRAISE_ADDRESSES } from '~/constants';
import NFTGrid from '~/components/NFT/NFTGrid';
import { useGenesisNFTContract, useWinterNFTContract, useBarnRaiseNFTContract } from '~/hooks/ledger/useContract';
import TransactionToast from '~/components/Common/TxnToast';
import useAccount from '../hooks/ledger/useAccount';
import AuthEmptyState from '~/components/Common/ZeroState/AuthEmptyState';
import PageHeader from '~/components/Common/PageHeader';
import GuideButton from '~/components/Common/Guide/GuideButton';
import { HOW_TO_MINT_BEANFTS } from '~/util/Guides';
import Row from '~/components/Common/Row';
import { FC } from '~/types';

const SLUGS = ['genesis', 'winter', 'barnraise'];

const NFTPage: FC<{}> = () => {
  const account = useAccount();
  const theme = useTheme();
  const { data: signer } = useSigner();
  const genesisContract = useGenesisNFTContract(signer);
  const winterContract = useWinterNFTContract(signer);

  // component state
  const [tab, handleChangeTab] = useTabs(SLUGS, 'collection');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parseMintTries, setParseMintTries] = useState(0)

  // NFT state
  const [selectedNFT, setSelectedNFT] = useState<Nft | null>(null);
  const [genesisNFTs, setGenesisNFTs] = useState<Nft[] | null>(null);
  const [winterNFTs, setWinterNFTs] = useState<Nft[] | null>(null);
  const [barnRaiseNFTs, setBarnRaiseNFTs] = useState<Nft[] | null>(null);
  const unmintedGenesis = genesisNFTs?.filter((nft) => nft.claimed === ClaimStatus.UNCLAIMED);
  const unmintedWinter = winterNFTs?.filter((nft) => nft.claimed === ClaimStatus.UNCLAIMED);

  /// Handlers
  const handleDialogOpen = (nft: Nft) => {
    setSelectedNFT(nft);
    setDialogOpen(true);
  };
  const handleDialogClose = () => {
    setSelectedNFT(null);
    setDialogOpen(false);
  };

  const delay = (ms:number) => new Promise(res => setTimeout(res, ms));

  const parseMints = useCallback(async (accountNFTs: Nft[], contractAddress: string, setNFTs: any) => {
    if (!account) {
      return;
    }
    const nfts: Nft[] = [];

    // batchNFTMetadata
    const nftMetadataBatchBaseURL =  'https://eth-mainnet.alchemyapi.io/nft/v2/demo/getNFTMetadataBatch'

    const ownedNfts: any[] = []
    let batchRequest: any[] = []

    try {
      if (accountNFTs.length > 0) {
        for (let i = 0; i < accountNFTs.length; i++) {
          batchRequest.push({ contractAddress: contractAddress, tokenId: accountNFTs[i].id })
          if (batchRequest.length === 100 || i === accountNFTs.length - 1) {
            let requestData = JSON.stringify(batchRequest)
            let request = await fetch(nftMetadataBatchBaseURL, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
              body: `{
                "tokens": ${requestData},
                "refreshCache": false
              }
              `
            })
            if (request.ok === false) {
              throw "ALCHEMY FETCH ERROR"
            }
            let response = await request.json()
            response.forEach((element: any) => {
              ownedNfts.push(element)
            });
            batchRequest = []
          } 
        }
      }

      const nftHashes = ownedNfts.map((nft: any) => nft.metadata.image.replace('ipfs://', ''));

      /// UNCLAIMED
      if (accountNFTs.length) {
        for (let i = 0; i < accountNFTs.length; i += 1) {
          let isNotMinted
          if (ownedNfts[i].error) {
            isNotMinted = true
          } else {
            isNotMinted = false
          }
          // if nft hash is NOT included in accountNFTs but IS minted
          // that means a new address owns this NFT now
          if (!nftHashes.includes(accountNFTs[i].imageIpfsHash) && isNotMinted) {
            nfts.push({ ...accountNFTs[i], claimed: ClaimStatus.UNCLAIMED });
          }
        }
      }

      /// CLAIMED
      if (ownedNfts.length) {
        for (let i = 0; i < ownedNfts.length; i += 1) {
          let subcollection = ADDRESS_COLLECTION[ownedNfts[i].contract.address]
          nfts.push({
            // Genesis BeaNFT titles: 'BeaNFT (ID number)' || Winter and Barn Raise BeaNFT titles: '(ID number)'
            id: (subcollection === BEANFT_GENESIS_ADDRESSES[1] ? parseInt(ownedNfts[i].title.split(' ')[1], 10) : ownedNfts[i].title),
            account: account,
            subcollection: subcollection,
            claimed: ClaimStatus.CLAIMED,
            imageIpfsHash: nftHashes[i]
          });
        }
      }

    } catch (e) {
      console.log("BEANFT - ERROR FETCHING METADATA", e)
      if (parseMintTries < 4) {
        console.log("BEANFT - RETRYING IN 3 SECONDS...")
        await delay(3000)
        setParseMintTries(parseMintTries + 1)
        console.log("BEANFT - FETCHING DATA...")
        parseMints(accountNFTs, contractAddress, setNFTs)
      }
    }

    setNFTs(nfts);
  }, [account]);

  // Mint Single Genesis BeaNFT
  const mintGenesis = () => {
    if (selectedNFT?.claimed === ClaimStatus.UNCLAIMED && account) {
      const txToast = new TransactionToast({
        loading: `Minting Genesis BeaNFT ${selectedNFT.id}...`,
        success: 'Mint successful.',
      });

      genesisContract.mint(getAccount(account), selectedNFT.id, selectedNFT.metadataIpfsHash as string, selectedNFT.signature as string)
        .then((txn) => {
          txToast.confirming(txn);
          return txn.wait();
        })
        .then((receipt) => {
          txToast.success(receipt);
        })
        .catch((err) => {
          console.error(
            txToast.error(err.error || err)
          );
        });
    }
  };

  // Mint All Genesis BeaNFTs
  const mintAllGenesis = () => {
    if (unmintedGenesis && genesisNFTs && account && unmintedGenesis?.length > 0) {
      const txToast = new TransactionToast({
        loading: 'Minting all Genesis BeaNFTs...',
        success: 'Mint successful.',
      });

      const accounts = Array(unmintedGenesis.length).fill(getAccount(account));
      const tokenIds = unmintedGenesis.map((nft) => nft.id);
      const ipfsHashes = unmintedGenesis.map((nft) => (nft.metadataIpfsHash as string));
      const signatures = unmintedGenesis.map((nft) => (nft.signature as string));
      genesisContract.batchMint(accounts, tokenIds, ipfsHashes, signatures)
        .then((txn) => {
          txToast.confirming(txn);
          return txn.wait();
        })
        .then((receipt) => {
          txToast.success(receipt);
        })
        .catch((err) => {
          console.error(
            txToast.error(err.error || err)
          );
        });
    }
  };

  // Mint Single Winter BeaNFT
  const mintWinter = () => {
    if (selectedNFT?.claimed === ClaimStatus.UNCLAIMED && account) {
      const txToast = new TransactionToast({
        loading: `Minting Winter BeaNFT ${selectedNFT.id}...`,
        success: 'Mint successful.',
      });

      winterContract.mint(getAccount(account), selectedNFT.id, selectedNFT.signature2 as string)
        .then((txn) => {
          txToast.confirming(txn);
          return txn.wait();
        })
        .then((receipt) => {
          txToast.success(receipt);
        })
        .catch((err) => {
          console.error(
            txToast.error(err.error || err)
          );
        });
    }
  };

  // Mint All Winter BeaNFTs
  const mintAllWinter = () => {
    if (unmintedWinter && winterNFTs && account && (unmintedWinter.length > 0)) {
      const txToast = new TransactionToast({
        loading: 'Minting all Winter BeaNFTs...',
        success: 'Mint successful.',
      });

      const tokenIds = unmintedWinter.map((nft) => nft.id);
      const signatures = unmintedWinter.map((nft) => (nft.signature2 as string));
      winterContract.batchMintAccount(getAccount(account), tokenIds, signatures)
        .then((txn) => {
          txToast.confirming(txn);
          return txn.wait();
        })
        .then((receipt) => {
          txToast.success(receipt);
        })
        .catch((err) => {
          console.error(
            txToast.error(err.error || err)
          );
        });
    }
  };

  // maps a NFT collection to a mint function
  const contractMap: { [s: string]: any } = {
    Genesis: mintGenesis,
    Winter: mintWinter,
  };

  useEffect(() => {
    if (account !== undefined) {
      loadNFTs(getAccount(account)).then((data) => {
        const genNFTs = data.genesis;
        const winNFTs = data.winter;
        const barnNFTs = data.barnRaise;

        parseMints(genNFTs, BEANFT_GENESIS_ADDRESSES[1], setGenesisNFTs);
        parseMints(winNFTs, BEANFT_WINTER_ADDRESSES[1], setWinterNFTs);
        parseMints(barnNFTs, BEANFT_BARNRAISE_ADDRESSES[1], setBarnRaiseNFTs);
      });
    }
  }, [account, parseMints]);

  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); //

  const hideGenesis = !unmintedGenesis || unmintedGenesis.length === 0;
  const hideWinter = !unmintedWinter || unmintedWinter.length === 0;

  return (
    <Container maxWidth="lg">
      <Stack spacing={2}>
        <PageHeader
          title="BeaNFTs"
          description="View and mint your BeaNFTs"
          href="https://docs.bean.money/almanac/ecosystem/beanfts"
          control={
            <GuideButton
              title="The Farmers' Almanac: BeaNFT Guides"
              guides={[
                HOW_TO_MINT_BEANFTS,
              ]}
            />
          }
        />
        <Card sx={{ p: 2 }}>
          <Stack gap={1.5}>
            <Row justifyContent="space-between" alignItems="center" sx={{ px: 0.5 }}>
              <Tabs value={tab} onChange={handleChangeTab} sx={{ minHeight: 0 }}>
                <Tab label={`Genesis (${genesisNFTs === null ? 0 : genesisNFTs?.length})`} />\
                <Tab label={`Winter (${winterNFTs === null ? 0 : winterNFTs?.length})`} />\
                <Tab label={`Barn Raise (${barnRaiseNFTs === null ? 0 : barnRaiseNFTs?.length})`} />
              </Tabs>
              {/* TODO: componentize these card action buttons */}
              {tab === 0 && genesisNFTs && !hideGenesis && (
                <Button size="small" onClick={mintAllGenesis} color="primary" variant="text" sx={{ p: 0, '&:hover': { backgroundColor: 'transparent' } }}>
                  {isMobile ? 'Mint all' : 'Mint All Genesis'}
                </Button>
              )}
              {tab === 1 && winterNFTs && !hideWinter && (
                <Button size="small" onClick={mintAllWinter} color="primary" variant="text" sx={{ p: 0, '&:hover': { backgroundColor: 'transparent' } }}>
                  {isMobile ? 'Mint all' : 'Mint All Winter'}
                </Button>
              )}
            </Row>
            {/* Zero state when not logged in */}
            {account === undefined ? (
              <Box height={300}>
                <AuthEmptyState message="Your BeaNFTs will appear here." />
              </Box>
            ) : (
              <>
                {/* genesis */}
                {tab === 0 && (
                  <NFTGrid
                    nfts={genesisNFTs}
                    handleDialogOpen={handleDialogOpen}
                  />
                )}
                {/* winter */}
                {tab === 1 && (
                  <NFTGrid
                    nfts={winterNFTs}
                    handleDialogOpen={handleDialogOpen}
                  />
                )}
                {/* barn raise */}
                {tab === 2 && (
                  <NFTGrid
                    nfts={barnRaiseNFTs}
                    handleDialogOpen={handleDialogOpen}
                  />
                )}
              </>
            )}
          </Stack>
        </Card>
      </Stack>
      {selectedNFT !== null && account &&
        <NFTDialog
          nft={selectedNFT}
          dialogOpen={dialogOpen}
          handleDialogClose={handleDialogClose}
          handleMint={contractMap[selectedNFT.subcollection]}
        />
      }
    </Container>
  );
};

export default NFTPage;
