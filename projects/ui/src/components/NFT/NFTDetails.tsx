import React from 'react';
import { Stack, Typography } from '@mui/material';
import { ClaimStatus, Nft } from '../../util/BeaNFTs';
import NFTImage from './NFTImage';
import Row from '~/components/Common/Row';

import { FC } from '~/types';
import { BeanstalkPalette } from '../App/muiTheme';

export interface NFTContentProps {
  collection: string;
  nft: Nft;
}

const NFTDetails: FC<NFTContentProps> = ({ nft, collection }) => (
  <Stack gap={1} sx={{ width: '100%', aspectRatio: '1/1' }}>
    <NFTImage nft={nft} />
    <Row alignItems="start" justifyContent="space-between">
      {/* Name */}
      <Typography variant="h4">
        BeaNFT {nft.id}
      </Typography>
      <Typography
        variant="bodySmall"
        textAlign="right"
        color={
          nft.claimed === ClaimStatus.UNCLAIMED
            ? BeanstalkPalette.logoGreen
            : 'text.tertiary'
        }
      >
        {nft.claimed === ClaimStatus.UNCLAIMED
          ? 'Ready to mint'
          : 'Minted'}
      </Typography>
    </Row>
  </Stack>
  );

export default NFTDetails;
