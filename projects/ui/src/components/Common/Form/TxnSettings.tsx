import React, { useCallback, useState } from 'react';
import {
  Box,
  IconButton,
  Stack,
  Typography,
  Popper,
  Grow,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { ClickAwayListener } from '@mui/base';
import { FC } from '~/types';

const PLACEMENTS = {
  'form-top-right': {
    position: 'absolute',
    top: 0,
    right: 0,
    pr: 1.3,
    pt: 1.45,
  },
  'condensed-form-top-right': {
    position: 'sticky',
    top: 0,
    right: 0,
    pr: 0.8,
    pt: 0.4,
  },
  'inside-form-top-right': {
    pb: 1,
    mt: -4,
    display: 'flex',
    flexDirection: 'row-reverse',
  },
};

const TxnSettings: FC<{
  placement?:
    | 'form-top-right'
    | 'condensed-form-top-right'
    | 'inside-form-top-right';
}> = ({ placement = 'form-top-right', children }) => {
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
    <ClickAwayListener onClickAway={handleHideMenu}>
      <Box sx={PLACEMENTS[placement]}>
        <IconButton size="small" onClick={handleToggleMenu}>
          <SettingsIcon
            sx={{
              fontSize: 20,
              transform: `rotate(${anchorEl ? 30 : 0}deg)`,
              transition: 'transform 150ms ease-in-out',
              color: 'text.primary',
            }}
          />
        </IconButton>
        <Popper
          anchorEl={anchorEl}
          open={menuVisible}
          sx={{ zIndex: 999 }}
          placement="bottom-end"
          // Align the menu to the bottom
          // right side of the anchor button.
          transition
        >
          {({ TransitionProps }) => (
            <Grow
              {...TransitionProps}
              timeout={200}
              style={{ transformOrigin: 'top right' }}
            >
              <Box
                sx={{
                  borderWidth: 2,
                  borderColor: 'divider',
                  borderStyle: 'solid',
                  backgroundColor: 'white',
                  borderRadius: 1,
                  py: 1,
                  px: 2,
                  '& .MuiInputBase-root:after, before': {
                    borderColor: 'primary.main',
                  },
                }}
              >
                <Stack gap={1}>
                  <Typography variant="h4" fontWeight="fontWeightBold">
                    Transaction Settings
                  </Typography>
                  <Box>
                    {children || (
                      <Typography>No settings for this transaction.</Typography>
                    )}
                  </Box>
                </Stack>
              </Box>
            </Grow>
          )}
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default TxnSettings;
