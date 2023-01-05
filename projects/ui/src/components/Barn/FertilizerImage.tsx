import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import fertActiveImage from '~/img/tokens/fert-logo-active.svg';
import fertUnusedImage from '~/img/tokens/fert-logo-unused.svg';
import fertUsedImage from '~/img/tokens/fert-logo-used.svg';
import { BeanstalkPalette } from '../App/muiTheme';
import './FertilizerImage.css';

import { FC } from '~/types';

export type FertilizerState = 'unused' | 'active' | 'used'
export const FERTILIZER_ICONS : { [key in FertilizerState]: string } = {
  unused: fertUnusedImage,
  active: fertActiveImage,
  used:   fertUsedImage,
};
export type FertilizerImageProps = {
  state?: FertilizerState;
  isNew? : boolean;
  progress?: number;
  id?: BigNumber;
};

const FertilizerImage : FC<FertilizerImageProps> = ({
  state = 'unused',
  isNew = false,
  progress,
  id,
}) => {
  const inner = (
    <Stack
      alignItems="center"
      justifyContent="center"
      sx={{
        height: '100%',
        aspectRatio: '1/1',
        borderColor: isNew ? BeanstalkPalette.logoGreen : 'divider',
        borderWidth: id ? 0 : 1, // if ID is present, use button border
        borderStyle: 'solid',
        borderRadius: 1,
        position: 'relative',
        '&:hover > .id': {
          display: 'block'
        }
      }}
      className="fert-item"
    >
      <img
        alt=""
        src={FERTILIZER_ICONS[state]}
        width="45%"
        css={{ position: 'relative', zIndex: 2 }}
        className={isNew ? 'fert-anim bounce' : id ? 'fert-anim bounce-hover' : undefined}
      />
      {id ? (
        <Box
          className="id" 
          sx={{
            display: 'none',
            position: 'absolute',
            bottom: 5,
            left: 10,
          }}
        >
          <Typography sx={{ fontSize: 11 }} color="gray">
            #{id.toString()}
          </Typography>
        </Box>
      ) : null}
      {progress ? (
        <Box
          sx={{
            background: BeanstalkPalette.logoGreen,
            opacity: 0.2,
            width: '100%',
            height: `${progress * 100}%`,
            position: 'absolute',
            bottom: 0,
            left: 0,
            zIndex: 0,
            borderBottomLeftRadius: 9,
            borderBottomRightRadius: 9
          }}
        />
      ) : null}
    </Stack>
  );

  if (id) {
    return (
      <Button
        variant="outlined"
        sx={{ borderColor: 'none', p: 0, height: 'auto' }}
        href={`https://opensea.io/assets/ethereum/0x402c84de2ce49af88f5e2ef3710ff89bfed36cb6/${id.toString()}`} 
        target="_blank"
        fullWidth
      >
        {inner}
      </Button>
    );
  }

  return inner;
};

export default FertilizerImage;
