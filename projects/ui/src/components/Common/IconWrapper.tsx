import React from 'react';
import { Box, BoxProps } from '@mui/material';

/**
 * An example of why we need IconWrapper:
 *
 * If a form has an Alert warning, we want the alert
 * text and icon to align with the Transaction Details.
 *
 * One way to do this is to set both icon sizes to the same
 * width and match the surrounding padding.
 *
 * The problem is that not all icons are 1:1 ratio, so what ends
 * up happening is the icons visually look different in size if
 * we just set all their widths the same.
 *
 * IconWrapper lets us put an icon in a fixed width box
 * so that the alignment of (for ex) Alert and Transaction Details
 * always match, while giving us the flexibility to freely
 * adjust their icon sizes independently of one another.
 */
import { FC } from '~/types';

const IconWrapper : FC<{ boxSize: number } & BoxProps> = ({ boxSize, children, sx }) => (
  <Box
    width={boxSize}
    height={boxSize}
    display="flex"
    alignItems="center"
    justifyContent="center"
    sx={{
      ...sx
    }}
  >
    {children}
  </Box>
);

export default IconWrapper;
