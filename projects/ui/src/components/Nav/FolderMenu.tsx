import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  ButtonProps,
  ClickAwayListener,
  Drawer,
  Popper,
  PopperPlacementType,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DropdownIcon from '~/components/Common/DropdownIcon';
import useToggle from '~/hooks/display/useToggle';
import useAnchor from '~/hooks/display/useAnchor';
import { BeanstalkPalette, borderRadius } from '~/components/App/muiTheme';

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
import NavDrawer from './NavDrawer';

const FolderMenu: FC<
  {
    startIcon?: any;
    noEndIcon?: boolean;
    buttonContent: JSX.Element;
    popoverContent?: JSX.Element;
    drawerContent?: JSX.Element;
    hideTextOnMobile?: boolean;
    popperWidth?: string;
    onOpen?: () => void;
    onClose?: () => void;
    hotkey: string;
    zIndex?: number;
    zeroTopRightRadius?: boolean;
    zeroTopLeftRadius?: boolean;
    popoverPlacement?: PopperPlacementType;
    navDrawer?: boolean;
  } & ButtonProps
> = ({
  startIcon,
  noEndIcon,
  buttonContent,
  popoverContent,
  drawerContent,
  hideTextOnMobile,
  popperWidth,
  hotkey,
  onOpen,
  onClose,
  /** fix: overlapping price and sun folders */
  zIndex = 998,
  zeroTopRightRadius,
  zeroTopLeftRadius,
  popoverPlacement,
  navDrawer,
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

  // Window
  const [mobileWindow, setMobileWindow] = useState(
    window.innerWidth <= theme.breakpoints.values.md
  );

  const open = useCallback(() => {
    if (isMobile || mobileWindow) {
      toggleAnchor(undefined); // force close menu if screen size has chnaged
      openDrawer();
    } else {
      closeDrawer(); // force close drawer if screen size has changed
      toggleAnchor({ currentTarget: button.current });
    }
    onOpen?.();
  }, [closeDrawer, isMobile, mobileWindow, onOpen, openDrawer, toggleAnchor]);

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

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < theme.breakpoints.values.lg && !mobileWindow) {
        setMobileWindow(true);
      } else {
        setMobileWindow(false);
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isOpen) {
      open();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileWindow]);

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
        endIcon={noEndIcon ? null : <DropdownIcon open={isOpen} />}
        onClick={isOpen ? close : open}
        disableRipple
        ref={(r) => {
          button.current = r;
        }}
        {...buttonProps}
        sx={{
          // Fully rounded by default; when open, remove
          // the bottom rounding to look like a "tab".
          borderBottomLeftRadius: popoverOpen && !mobileWindow ? 0 : undefined,
          borderBottomRightRadius: popoverOpen && !mobileWindow ? 0 : undefined,
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
          minWidth: '0px',
          // Positioning and other styles.
          ...buttonProps.sx,
          '&:hover': {
            borderColor: 'divider',
            borderBottomColor: popoverOpen ? 'white' : undefined,
          },
        }}
      >
        <Box
          sx={{
            display: { xs: hideTextOnMobile ? 'none' : 'block', sm: 'block' },
          }}
        >
          <Typography variant="h3">{buttonContent}</Typography>
        </Box>
      </Button>
      <Popper
        open={popoverOpen}
        anchorEl={anchorEl}
        placement={popoverPlacement || 'bottom-start'}
        disablePortal
        sx={{
          zIndex: zIndex,
          visibility: mobileWindow ? 'hidden' : 'visible',
        }}
        modifiers={[
          {
            name: 'computeStyles',
            options: {
              gpuAcceleration: false,
              roundOffsets: ({ x, y }: any) => ({
                x: Math.round(x),
                y: y,
              }),
            },
          },
        ]}
        nonce={undefined}
        onResize={undefined}
        onResizeCapture={undefined}
      >
        <Box
          sx={(_theme) => ({
            background: BeanstalkPalette.white,
            width: popperWidth !== undefined ? popperWidth : '325px',
            borderBottomLeftRadius: borderRadius * 1,
            borderBottomRightRadius: borderRadius * 1,
            borderTopRightRadius: zeroTopRightRadius ? 0 : borderRadius * 1,
            borderTopLeftRadius: zeroTopLeftRadius ? 0 : borderRadius * 1,
            borderColor: theme.palette.divider,
            borderWidth: 1,
            borderStyle: 'solid',
            boxSizing: 'border-box',
            // px: 1,
            // py: 1,
            boxShadow: _theme.shadows[0],
            // Should be below the zIndex of the Button.
            zIndex: zIndex,
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
      {navDrawer ? (
        <NavDrawer open={drawerOpen} hideDrawer={closeDrawer} />
      ) : null}
      {drawerContent ? (
        <Drawer anchor="bottom" open={drawerOpen} onClose={closeDrawer}>
          {drawerContent}
        </Drawer>
      ) : null}
      {isMobile ? (
        <Box>{content}</Box>
      ) : (
        <ClickAwayListener
          mouseEvent="onMouseUp"
          touchEvent="onTouchStart"
          onClickAway={handleClickAway}
        >
          {content}
        </ClickAwayListener>
      )}
    </>
  );
};

export default FolderMenu;
