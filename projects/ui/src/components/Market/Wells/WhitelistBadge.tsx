import React from 'react';
import { Chip } from '@mui/material';
import { BeanstalkPalette, FontSize, FontWeight } from '~/components/App/muiTheme';

const WhitelistBadge: React.FC<{ isWhitelisted: boolean }> = ({ isWhitelisted }) => (
  <>
    {isWhitelisted ? (
      <Chip
        label="Whitelisted in Silo"
        size="small"
        sx={{
          backgroundColor: BeanstalkPalette.lightGreen,
          color: BeanstalkPalette.logoGreen,
          fontSize: FontSize.sm, // 16px
          fontWeight: FontWeight.semiBold,
          py: 0.5,
          px: 0.5,
        }}
      />
    ) : (
      <Chip
        label="Not Whitelisted"
        size="small"
        sx={{
          backgroundColor: BeanstalkPalette.washedRed,
          color: BeanstalkPalette.trueRed,
          fontSize: FontSize.sm, // 16px
          fontWeight: FontWeight.semiBold,
          py: 0.5,
          px: 0.5,
        }}
      />
    )}

  </>

);

export default WhitelistBadge;
