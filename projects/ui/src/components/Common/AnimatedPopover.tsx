import React, { useState } from 'react';
import { SxProps, Theme, Popover, Box } from '@mui/material';

/**
 * @note unused as of 10/21/2022
 */
const AnimatedPopover: React.FC<{
  children: React.ReactNode;
  popperEl: JSX.Element;
  id: string;
  disableAnimate?: boolean;
  disabled?: boolean;
  sx?: React.CSSProperties | SxProps<Theme>;
  scale?: number;
}> = ({
  children,
  popperEl,
  id,
  disableAnimate,
  disabled,
  sx,
  scale = 1.04,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);

  const open = Boolean(anchorEl);
  const _id = open ? `simple-popover-${id}` : undefined;

  const handleOpen = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    setAnchorEl(e.currentTarget);
  };

  return (
    <>
      <Box
        sx={{
          ':hover': {
            transform: !disableAnimate ? `scale(${scale})` : undefined,
            transition: !disableAnimate ? 'all .3s ease 0s' : undefined,
            transformOrigin: 'top center',
            height: '100%',
          },
          cursor: 'pointer',
          ...sx,
        }}
        onClick={(e) => handleOpen(e)}
      >
        {children}
      </Box>
      <Popover
        id={_id}
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        sx={{
          '& .MuiPaper-root': {
            boxShadow: 'none'
          }
        }}
      >
        {popperEl}
      </Popover>
    </>
  );
};

export default AnimatedPopover;
