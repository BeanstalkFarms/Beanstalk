import React from 'react';
import { CircularProgress, CircularProgressProps, Stack } from '@mui/material';
import beanIcon from '~/img/tokens/bean-logo-circled.svg';
import { FC } from '~/types';

const PROGRESS_THICKNESS = 2;
const PROGRESS_GAP = 3.5;

const BeanProgressIcon : FC<CircularProgressProps & {
  size: number;
  enabled: boolean;
  progress?: number;
}> = ({
  size,
  enabled,
  variant,
  progress
}) => (
  <Stack sx={{ position: 'relative' }}>
    {enabled ? (
      <CircularProgress
        variant={variant}
        color="primary"
        size={size + PROGRESS_GAP * 2}
        value={progress}
        sx={{
              position: 'absolute',
              left: -PROGRESS_GAP,
              top: -PROGRESS_GAP,
              zIndex: 10,
            }}
        thickness={PROGRESS_THICKNESS}
          />
        ) : null}
    <img
      src={beanIcon}
      alt="Bean"
      css={{ height: size, width: size }} />
  </Stack>
  );

export default BeanProgressIcon;
