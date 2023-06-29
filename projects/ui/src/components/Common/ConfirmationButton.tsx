import { Box, Button, ButtonProps } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { FC } from '~/types';

export const ConfirmationButton: FC<
  ButtonProps & { delay?: number; mode?: 'left-to-right' | 'bottom-to-top' }
> = ({ children, sx, delay = 3000, mode = 'bottom-to-top', ...props }) => {
  const [allowConfirm, setAllowConfirm] = useState(false);
  const [fill, setFill] = useState('');

  useEffect(() => {
    setTimeout(() => {
      setFill('fill');
    }, 0);
    setTimeout(() => {
      setAllowConfirm(true);
    }, delay);
  }, [delay]);

  const staticProp = mode === 'bottom-to-top' ? 'width' : 'height';
  const dynamicProp = mode === 'bottom-to-top' ? 'height' : 'width';

  return (
    <Button
      disabled={!allowConfirm}
      sx={{ position: 'relative', overflow: 'hidden', ...sx }}
      {...props}
    >
      <Box
        sx={{
          background: 'rgba(0,0,0,0.03)',
          // display: !allowConfirm ? 'none' : 'block',
          [staticProp]: '100%',
          transition: `${dynamicProp} ${delay}ms linear`,
          [dynamicProp]: '0%',
          position: 'absolute',
          left: 0,
          bottom: 0,
          '&.fill': {
            transition: `${dynamicProp} ${delay}ms linear`,
            [dynamicProp]: '100%',
          },
        }}
        className={fill}
      />
      {children}
    </Button>
  );
};
