import React from 'react';
import { Button, Dialog, Link } from '@mui/material';
import { FC } from '~/types';
import useSetting from '~/hooks/app/useSetting';
import {
  StyledDialogActions,
  StyledDialogContent,
  StyledDialogTitle,
} from '../Common/Dialog';
import { ClaimStatus, Nft } from '../../util/BeaNFTs';
import NFTImage from './NFTImage';

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
  nft,
}) => {
  const nftImage = <NFTImage nft={nft} />;

  // Are we impersonating a different account outside dev mode
  const isImpersonating =
    !!useSetting('impersonatedAccount')[0] && !import.meta.env.DEV;

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
            href={`https://opensea.io/assets/ethereum/${nft.subcollection}/${nft.id}`}
            target="_blank"
            rel="noreferrer"
          >
            {nftImage}
          </Link>
        ) : (
          nftImage
        )}
      </StyledDialogContent>
      <StyledDialogActions sx={{ pt: 0 }}>
        {/* FIXME: should be a LoadingButton */}
        <Button
          onClick={handleMint}
          disabled={nft.claimed === ClaimStatus.CLAIMED || isImpersonating}
          sx={{ height: '45px', width: '100%' }}
        >
          {nft.claimed === ClaimStatus.CLAIMED
            ? 'Minted'
            : isImpersonating
              ? 'Impersonating Account'
              : 'Mint'}
        </Button>
      </StyledDialogActions>
    </Dialog>
  );
};

export default NFTDialog;
