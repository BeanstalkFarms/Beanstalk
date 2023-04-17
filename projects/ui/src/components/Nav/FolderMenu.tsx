import React, { useCallback, useRef } from 'react';
import {
  Box,
  Button,
  ButtonProps, ClickAwayListener,
  Drawer,
  Popper,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DropdownIcon from '~/components/Common/DropdownIcon';
import useToggle from '~/hooks/display/useToggle';
import useAnchor from '~/hooks/display/useAnchor';
import { BeanstalkPalette, PAGE_BORDER_COLOR } from '~/components/App/muiTheme';

/**
 * Show a "Folder". A folder is a button that shows a popup;
 * the type of popup varies depending on the screen size.
 *
 * On desktop: Clicking the Button creates a folder-like Popover.
 *             The Popover is designed to look like it "expands"
 *             out of the button. See <PriceButton/> for example.
 * On mobile:  Clicking the Button shows a Drawer.
 */
import { FC } from '~/types';

const FolderMenu: FC<{
  startIcon?: any;
  buttonContent: JSX.Element;
  popoverContent: JSX.Element;
  drawerContent: JSX.Element;
  hideTextOnMobile?: boolean;
  popperWidth?: string;
  onOpen?: () => void;
  hotkey: string;
  zIndex?: number;
} & ButtonProps> = ({
  startIcon,
  buttonContent,
  popoverContent,
  drawerContent,
  hideTextOnMobile,
  popperWidth,
  hotkey,
  onOpen,
  /** fix: overlapping price and sun folders */
  zIndex = 998,
  ...buttonProps
}) => {
  // Theme
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  // Popover
  const [anchorEl, toggleAnchor] = useAnchor();
  const popoverOpen = Boolean(anchorEl);
  const button = useRef<HTMLButtonElement | null>(null);

  // Drawer
  const [drawerOpen, openDrawer, closeDrawer] = useToggle();
  const isOpen = Boolean(anchorEl || drawerOpen);

  const open = useCallback(() => {
    if (isMobile) {
      toggleAnchor(undefined); // force close menu if screen size has chnaged
      openDrawer();
    } else {
      closeDrawer(); // force close drawer if screen size has changed
      toggleAnchor({ currentTarget: button.current });
    }
    onOpen?.();
  }, [closeDrawer, isMobile, onOpen, openDrawer, toggleAnchor]);

  const close = useCallback(() => {
    if (isMobile) {
      closeDrawer();
    } else {
      toggleAnchor(undefined);
    }
  }, [closeDrawer, isMobile, toggleAnchor]);

  const handleClickAway = () => {
    close();
  };

  // Hotkeys
  // useHotkeys(hotkey || '', () => {
  //   console.debug('toggle');
  //   isOpen ? close() : open();
  // }, {}, [isOpen, open, close]);

  const content = (
    <Box>
      <Button
        color="light"
        startIcon={startIcon}
        endIcon={<DropdownIcon open={isOpen} />}
        onClick={isOpen ? close : open}
        disableRipple
        ref={(r) => {
          button.current = r;
        }}
        {...buttonProps}
        sx={{
          // Fully rounded by default; when open, remove
          // the bottom rounding to look like a "tab".
          borderBottomLeftRadius: popoverOpen ? 0 : undefined,
          borderBottomRightRadius: popoverOpen ? 0 : undefined,
          // Enforce a default white border; switch the color
          // to secondary when the Popper is open.
          borderWidth: 1,
          boxSizing: 'border-box',
          borderStyle: 'solid',
          borderColor: popoverOpen ? 'divider' : 'white',
          // Keep this white so we can make it look like the
          // button is "expanding" into a Box when you click it.
          borderBottomColor: 'white',
          // Without disabling the transition, the border fades
          // in/out and looks weird.
          transition: 'none !important',
          // Move the button above the Box so we can slice off
          // the 1px border at the top of the Box.
          zIndex: popoverOpen ? 999 : undefined,
          // Positioning and other styles.
          ...buttonProps.sx,
          '&:hover': {
            borderColor: 'divider',
            borderBottomColor: 'white'
          }
        }}
      >
        <Box sx={{ display: { xs: hideTextOnMobile ? 'none' : 'block', sm: 'block' } }}>
          <Typography variant="h3">
            {buttonContent}
          </Typography>
        </Box>
      </Button>
      <Popper
        open={popoverOpen}
        anchorEl={anchorEl}
        placement="bottom-start"
        disablePortal
        sx={{
          zIndex,
        }}
        nonce={undefined}
        onResize={undefined}
        onResizeCapture={undefined}
      >
        <Box
          sx={(_theme) => ({
            background: BeanstalkPalette.white,
            width: popperWidth !== undefined ? popperWidth : '325px',
            borderBottomLeftRadius: _theme.shape.borderRadius,
            borderBottomRightRadius: _theme.shape.borderRadius,
            borderTopRightRadius: _theme.shape.borderRadius,
            borderColor: PAGE_BORDER_COLOR,
            borderWidth: 1,
            borderStyle: 'solid',
            boxSizing: 'border-box',
            // px: 1,
            // py: 1, 
            boxShadow: _theme.shadows[0],
            // Should be below the zIndex of the Button.
            zIndex,
            mt: '-1px',
          })}
        >
          {popoverContent}
        </Box>
      </Popper>
    </Box>
  );
  
  return (
    <>
      {/* Mobile: Drawer */}
      <Drawer anchor="bottom" open={drawerOpen} onClose={closeDrawer}>
        {drawerContent}
      </Drawer>
      {isMobile ? (
        <Box>
          {content}
        </Box>
      ) : (
        <ClickAwayListener mouseEvent="onMouseUp" touchEvent="onTouchStart" onClickAway={handleClickAway}>
          {content}
        </ClickAwayListener>
      )}
    </>
  );
};

export default FolderMenu;
