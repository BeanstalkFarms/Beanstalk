import React from 'react';
import { Box, Card, CircularProgress, Grid, Stack, Typography, Link } from '@mui/material';
import { Nft } from '~/util/BeaNFTs';
import NFTDetails from './NFTDetails';
import { BeanstalkPalette } from '../App/muiTheme';
import { FC } from '~/types';

export interface NFTGridProps {
  nfts: Nft[] | null;
  collectionAddress: string;
  handleDialogOpen: any;
}

const NFTGrid: FC<NFTGridProps> = ({ nfts, collectionAddress, handleDialogOpen }) => {
  if (nfts === null) {
    return (
      <Stack
        width="100%"
        height={300}
        alignItems="center"
        justifyContent="center"
      >
        <CircularProgress variant="indeterminate" />
      </Stack>
    );
  }

  

  return (
    <>
      {nfts.length === 0 ? (
        <Box
          height={300}
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
        >
          <Typography variant="body1" color="gray">
            You don&apos;t have any NFTs from this collection!
          </Typography>
          <Link href={`https://opensea.io/assets/ethereum/${collectionAddress}`} variant="body1" color="primary">
            Explore this collection on Opensea →
          </Link>
        </Box>
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
                    opacity: 0.95,
                  },
                }}
              >
                <NFTDetails collection={nft.subcollection} nft={nft} />
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </>
  );
};

export default NFTGrid;
