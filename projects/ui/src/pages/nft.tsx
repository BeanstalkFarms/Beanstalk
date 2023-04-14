import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Card, Container, Stack, Tab, Tabs, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSigner } from '~/hooks/ledger/useSigner';
import useTabs from '~/hooks/display/useTabs';
import { getAccount } from '~/util/Account';
import { ADDRESS_COLLECTION, ClaimStatus, loadNFTs, Nft } from '~/util/BeaNFTs';
import NFTDialog from '~/components/NFT/NFTDialog';
import { BEANFT_GENESIS_ADDRESSES, BEANFT_WINTER_ADDRESSES } from '~/constants';
import NFTGrid from '~/components/NFT/NFTGrid';
import { useGenesisNFTContract, useWinterNFTContract } from '~/hooks/ledger/useContract';
import TransactionToast from '~/components/Common/TxnToast';
import useAccount from '../hooks/ledger/useAccount';
import AuthEmptyState from '~/components/Common/ZeroState/AuthEmptyState';
import PageHeader from '~/components/Common/PageHeader';
import GuideButton from '~/components/Common/Guide/GuideButton';
import { HOW_TO_MINT_BEANFTS } from '~/util/Guides';
import Row from '~/components/Common/Row';
import { FC } from '~/types';

const SLUGS = ['genesis', 'winter'];

const NFTPage: FC<{}> = () => {
  const account = useAccount();
  const theme = useTheme();
  const { data: signer } = useSigner();
  const genesisContract = useGenesisNFTContract(signer);
  const winterContract = useWinterNFTContract(signer);

  // component state
  const [tab, handleChangeTab] = useTabs(SLUGS, 'collection');
  const [dialogOpen, setDialogOpen] = useState(false);

  // NFT state
  const [selectedNFT, setSelectedNFT] = useState<Nft | null>(null);
  const [genesisNFTs, setGenesisNFTs] = useState<Nft[] | null>(null);
  const [winterNFTs, setWinterNFTs] = useState<Nft[] | null>(null);
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

  const parseMints = useCallback(async (accountNFTs: Nft[], contractAddress: string, setNFTs: any) => {
    if (!account) {
      return;
    }
    const requestOptions: any = {
      method: 'GET',
      redirect: 'follow'
    };

    const nfts: Nft[] = [];

    // getNFTs
    const nftsBaseURL = 'https://eth-mainnet.alchemyapi.io/nft/v2/demo/getNFTs/';
    const nftsFetchURL = `${nftsBaseURL}?owner=${account?.toLowerCase()}&contractAddresses[]=${contractAddress}`;

    // getNFTMetadata
    const nftMetadataBaseURL = 'https://eth-mainnet.alchemyapi.io/nft/v2/demo/getNFTMetadata';
    const nftMetadataFetchURL = (id: number) => `${nftMetadataBaseURL}?&contractAddress=${contractAddress}&tokenId=${id.toString()}`;

    const [
      // BeaNFTs owned by this account
      userMintedNFTs,
      // BeaNFTs originally assigned to this account
      originalUserNFTs
    ] = await Promise.all([
      fetch(nftsFetchURL, requestOptions)
        .then((response) => response.json()),
      await Promise.all(accountNFTs.map((nft) => fetch(nftMetadataFetchURL(nft.id), requestOptions)
          .then((response) => response.json())))
    ]);

    const ownedNfts = userMintedNFTs.ownedNfts;
    const nftHashes = ownedNfts.map((nft: any) => nft.metadata.image.replace('ipfs://', ''));

    /// UNCLAIMED
    if (accountNFTs.length) {
      for (let i = 0; i < accountNFTs.length; i += 1) {
        // if nft hash is NOT included in accountNFTs but IS minted
        // that means a new address owns this NFT now
        const isNotMinted = originalUserNFTs[i].error;
        if (!nftHashes.includes(accountNFTs[i].imageIpfsHash) && isNotMinted) {
          nfts.push({ ...accountNFTs[i], claimed: ClaimStatus.UNCLAIMED });
        }
      }
    }
    /// CLAIMED
    if (ownedNfts.length) {
      for (let i = 0; i < ownedNfts.length; i += 1) {
        nfts.push({
          // assumes title is formatted: "BeaNFT 1234"
          id: parseInt(ownedNfts[i].title.split(' ')[1], 10),
          account: account,
          subcollection: ADDRESS_COLLECTION[ownedNfts[i].contract.address],
          claimed: ClaimStatus.CLAIMED,
          imageIpfsHash: nftHashes[i]
        });
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

        parseMints(genNFTs, BEANFT_GENESIS_ADDRESSES[1], setGenesisNFTs);
        parseMints(winNFTs, BEANFT_WINTER_ADDRESSES[1], setWinterNFTs);
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
                <Tab label={`Winter (${winterNFTs === null ? 0 : winterNFTs?.length})`} />
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
