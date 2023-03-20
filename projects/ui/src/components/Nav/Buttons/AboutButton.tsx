import React from 'react';
import {
  Box,
  Button,
  ButtonProps,
  Card,
  ListItemText,
  MenuList,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { useHotkeys } from 'react-hotkeys-hook';
import useChainConstant from '~/hooks/chain/useChainConstant';
import useAnchor from '~/hooks/display/useAnchor';
import useToggle from '~/hooks/display/useToggle';
import { BEANSTALK_ADDRESSES, CHAIN_INFO } from '~/constants';
import ROUTES from '../routes';
import MenuItem from '../MenuItem';
import SettingsDialog from '~/components/Nav/SettingsDialog';
import useGlobal from '~/hooks/app/useGlobal';
import Row from '~/components/Common/Row';
import FolderMenu from '../FolderMenu';

import { FC } from '~/types';
import { BeanstalkPalette } from '~/components/App/muiTheme';

const AboutButton: FC<ButtonProps> = ({ sx }) => {
  /// Theme
  const theme = useTheme();
  const isMedium = useMediaQuery(theme.breakpoints.down('lg')); // trim additional account text at medium

  /// Constants
  const chainInfo = useChainConstant(CHAIN_INFO);
  const beanstalkAddress = useChainConstant(BEANSTALK_ADDRESSES);

  /// Menu
  const [anchorEl, toggleAnchor] = useAnchor();

  /// Drawer
  const [open, show, hide] = useToggle(toggleAnchor, toggleAnchor);

  /// Settings
  const [settingsOpen, setSettingsOpen] = useGlobal('showSettings');
  useHotkeys('ctrl+, cmd+,', (e) => {
    e.preventDefault();
    setSettingsOpen(!settingsOpen);
  }, { }, [settingsOpen]);

  /// Content
  const menuContent = (
        <MenuList 
      component={Card} 
      sx={{ 
        background: BeanstalkPalette.white, 
        border: '0px solid transparent',
        borderTopRightRadius: 0,
      }} 
      >
      {/* Menu Items */}
      {/* <MenuItem
        item={{ title: 'Settings', path: '/settings' }}
        onClick={onOpenSettings}
      /> */}
      {ROUTES.additional.map((item) => (
        <MenuItem key={item.path} item={item} onClick={toggleAnchor} />
      ))}
      {/* Contract Button Container */}
      <Box sx={{ px: 1, pt: 0.75, pb: 0.2 }}>
        <Button
          fullWidth
          href={`${chainInfo.explorer}/address/${beanstalkAddress}`}
          target="_blank"
          rel="noreferrer"
          variant="contained"
          color="primary"
          sx={{ py: 0.9 }}
        >
          <Row spacing={1}>
            <ListItemText>
              <Typography variant="h4">
                Contract: {beanstalkAddress.slice(0, 6)}...
              </Typography>
            </ListItemText>
            <Typography variant="body2" color="white">
              <ArrowForwardIcon
                sx={{ transform: 'rotate(-45deg)', fontSize: 12 }}
              />
            </Typography>
          </Row>
        </Button>
      </Box>
    </MenuList>
  );

  return (
    <>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {/**
       * Nav Drawer
       * ----------
       * Contains all nav items in one fullscreen drawer.
       * Triggered by AboutButton on mobile.
       * Activated by enabling the navDrawer property on FolderMenu
       */}
      <FolderMenu
        buttonContent={<Typography sx={{ mt: 0.5 }}><MoreHorizIcon /></Typography>}
        popoverContent={menuContent}
        navDrawer
        noEndIcon
        onOpen={show}
        onClose={hide}
        popperWidth="250px"
        hotkey="opt+2, alt+2"
        zeroTopRightRadius
      />
    </>
  );
};

export default AboutButton;
