import React, { useCallback, useState } from 'react';
import { Box, IconButton, Menu, Stack, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

import { FC } from '~/types';

const PLACEMENTS = {
  'form-top-right': {
    position: 'absolute',
    top: 0,
    right: 0,
    pr: 1.3,
    pt: 1.45
  },
  'condensed-form-top-right': {
    position: 'absolute',
    top: 0,
    right: 0,
    pr: 0.8,
    pt: 0.4
  },
};

const TxnSettings : FC<{
  placement?: 'form-top-right' | 'condensed-form-top-right',
}> = ({ 
  placement = 'form-top-right',
  children
}) => {
  // Menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuVisible = Boolean(anchorEl);
  const handleToggleMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setAnchorEl(anchorEl ? null : event.currentTarget);
    },
    [anchorEl]
  );
  const handleHideMenu = useCallback(() => {
    setAnchorEl(null);
  }, []);

  return (
    <Box sx={PLACEMENTS[placement]}>
      <IconButton size="small" onClick={handleToggleMenu}>
        <SettingsIcon sx={{ fontSize: 20, transform: `rotate(${anchorEl ? 30 : 0}deg)`, transition: 'transform 150ms ease-in-out', color: 'text.primary' }} />
      </IconButton>
      <Menu
        elevation={0}
        anchorEl={anchorEl}
        open={menuVisible}
        onClose={handleHideMenu}
        PaperProps={{
          sx: {
            borderWidth: 2,
            borderColor: 'divider',
            borderStyle: 'solid',
            py: 0.5,
            px: 2,
            '& .MuiInputBase-root:after, before': {
              borderColor: 'primary.main'
            }
          }
        }}
        // Align the menu to the bottom 
        // right side of the anchor button. 
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Stack gap={1}>
          <Typography variant="h4" fontWeight="fontWeightBold">Transaction Settings</Typography>
          <Box>
            {children || <Typography>No settings for this transaction.</Typography>}
          </Box>
        </Stack>
      </Menu>
    </Box>
  );
};

export default TxnSettings;
