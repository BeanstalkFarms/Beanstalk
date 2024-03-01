import React from 'react';
import { CircularProgress, Stack } from '@mui/material';
import beanIcon from '~/img/tokens/bean-logo-circled.svg';

const PROGRESS_THICKNESS = 2;
const PROGRESS_GAP = 3.5;

interface ProgressIconProps {
  size: number;
  enabled: boolean;
  variant: any;
  progress?: number;
}

export default function BeanProgressIcon({
  size,
  enabled,
  variant,
  progress,
}: ProgressIconProps) {
  return (
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
      <img src={beanIcon} alt="Bean" style={{ height: size, width: size }} />
    </Stack>
  );
}
