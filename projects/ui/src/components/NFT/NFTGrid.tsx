import React from 'react';
import { Card, CircularProgress, Grid, Stack } from '@mui/material';
import { Nft } from '~/util/BeaNFTs';
import NFTDetails from './NFTDetails';
import { BeanstalkPalette } from '../App/muiTheme';
import EmptyState from '../Common/ZeroState/EmptyState';

import { FC } from '~/types';

export interface NFTGridProps {
  nfts: Nft[] | null;
  handleDialogOpen: any;
}

const NFTGrid: FC<NFTGridProps> = ({
 nfts,
 handleDialogOpen,
}) => {
  if (nfts === null) {
    return (
      <Stack width="100%" height={300} alignItems="center" justifyContent="center">
        <CircularProgress variant="indeterminate" />
      </Stack>
    );
  }

  return (
    <>
      {
        (nfts.length === 0) ? (
          <EmptyState message="You don't have any NFTs from this collection!" />
        ) : (
          <Grid container spacing={{ md: 3, xs: 2 }}>
            {nfts.map((nft) => (
              <Grid key={nft.id} item md={4} xs={12}>
                <Card
                  onClick={() => handleDialogOpen(nft)}
                  sx={{
                    p: 1,
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: BeanstalkPalette.lightestBlue,
                      opacity: 0.95
                    }
                  }}>
                  <NFTDetails
                    collection={nft.subcollection}
                    nft={nft}
                  />
                </Card>
              </Grid>
            ))}
          </Grid>
        )
      }
    </>
  );
};

export default NFTGrid;
