import React from 'react';
import { Button, Dialog, Link } from '@mui/material';
import { StyledDialogActions, StyledDialogContent, StyledDialogTitle } from '../Common/Dialog';
import { ClaimStatus, COLLECTION_ADDRESS, Nft } from '../../util/BeaNFTs';
import NFTImage from './NFTImage';

import { FC } from '~/types';

export interface NFTDialogProps {
  handleDialogClose: any;
  dialogOpen: boolean;
  handleMint: any;
  nft: Nft;
}

const NFTDialog: FC<NFTDialogProps> = ({
  handleDialogClose,
  dialogOpen,
  handleMint,
  nft
}) => {
  const nftImage = <NFTImage nft={nft} />;
  return (
    <Dialog
      onClose={handleDialogClose}
      open={dialogOpen}
      fullWidth
      PaperProps={{ sx: { width: '400px' } }}
    >
      <StyledDialogTitle onClose={handleDialogClose}>
        BeaNFT {nft.id}
      </StyledDialogTitle>
      <StyledDialogContent sx={{ px: 1, pb: 1 }}>
        {nft.claimed === 0 ? (
          <Link
            href={
            `https://opensea.io/assets/ethereum/${COLLECTION_ADDRESS[nft.subcollection]}/${nft.id}`
          }
            target="_blank"
            rel="noreferrer">
            {nftImage}
          </Link>
        ) : nftImage}
      </StyledDialogContent>
      <StyledDialogActions sx={{ pt: 0 }}>
        {/* FIXME: should be a LoadingButton */}
        <Button
          onClick={handleMint}
          disabled={nft.claimed === ClaimStatus.CLAIMED}
          sx={{ height: '45px', width: '100%' }}
        >
          {nft.claimed === ClaimStatus.CLAIMED ? 'Minted' : 'Mint'}
        </Button>
      </StyledDialogActions>
    </Dialog>
  );
};

export default NFTDialog;
