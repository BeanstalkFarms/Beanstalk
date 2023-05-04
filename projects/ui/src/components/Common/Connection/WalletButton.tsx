import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  useDisconnect,
  useNetwork,
  useAccount as useWagmiAccount,
} from 'wagmi';
import {
  Box,
  Button,
  ButtonProps,
  Card,
  Divider,
  ListItemText,
  MenuItem,
  MenuList,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { IMPERSONATED_ACCOUNT, trimAddress } from '~/util';
import useChainConstant from '~/hooks/chain/useChainConstant';
import gearIcon from '~/img/beanstalk/interface/nav/gear.svg';
import historyIcon from '~/img/beanstalk/interface/nav/history.svg';
import etherscanIcon from '~/img/beanstalk/interface/nav/etherscan.svg';
import disconnectIcon from '~/img/beanstalk/interface/nav/disconnect.svg';
import useAnchor from '~/hooks/display/useAnchor';
import useToggle from '~/hooks/display/useToggle';
import useAccount from '~/hooks/ledger/useAccount';
import { CHAIN_INFO } from '~/constants';
import WalletDialog from './WalletDialog';
import PickBeansDialog from '~/components/Farmer/Unripe/PickDialog';
import AddressIcon from '~/components/Common/AddressIcon';
import useGlobal from '~/hooks/app/useGlobal';
import Row from '~/components/Common/Row';
import FolderMenu from '~/components/Nav/FolderMenu';

import { FC } from '~/types';
import { BeanstalkPalette } from '~/components/App/muiTheme';

const WalletButton: FC<{ showFullText?: boolean } & ButtonProps> = ({
  ...props
}) => {
  const account = useAccount();
  const { address } = useWagmiAccount();
  const { chain: _chain } = useNetwork();
  const { disconnect } = useDisconnect();
  const chain = useChainConstant(CHAIN_INFO);

  /// Theme
  const theme = useTheme();
  const isMedium = useMediaQuery(theme.breakpoints.down('md')); // trim additional account text

  /// Menu
  const [menuAnchor, toggleMenuAnchor] = useAnchor();
  const menuVisible = Boolean(menuAnchor);

  /// Dialog: Wallet
  const [selectingWallet, showWallets, hideWallets] = useToggle();

  /// Dialog: Pick Unripe Beans
  const [picking, showPick, hidePick] = useToggle(toggleMenuAnchor);

  /// Dialog: Settings
  const [_, setSettingsOpen] = useGlobal('showSettings');

  /// Display: Not Connected
  if (!account || !_chain?.id) {
    return (
      <>
        <Button
          variant="contained"
          color="primary"
          {...props}
          onClick={showWallets}
        >
          Connect
          <Box
            component="span"
            display={{
              xs: props.showFullText ? 'inline' : 'none',
              md: 'inline',
            }}
          >
            &nbsp;Wallet
          </Box>
        </Button>
        <WalletDialog
          open={selectingWallet}
          handleClose={hideWallets}
          fullScreen={isMedium}
        />
      </>
    );
  }

  const menu = (
    <MenuList
      component={Card}
      sx={{
        minWidth: 250,
        background: BeanstalkPalette.white,
        border: '0px solid transparent',
        borderTopRightRadius: 0,
      }}
    >
      <MenuItem
        onClick={() => {
          toggleMenuAnchor();
          setSettingsOpen(true);
        }}
      >
        <ListItemText>
          <Row gap={1}>
            <img src={gearIcon} alt="Settings" width={20} />
            <Typography variant="body1" color="text.primary">
              Settings
            </Typography>
          </Row>
        </ListItemText>
      </MenuItem>
      <MenuItem component={RouterLink} to="/history" onClick={toggleMenuAnchor}>
        <Row gap={1}>
          <img src={historyIcon} alt="History" width={20} />
          <Typography variant="body1" color="text.primary">
            History
          </Typography>
        </Row>
      </MenuItem>
      <MenuItem
        component="a"
        href={`${chain.explorer}/address/${account}`}
        target="_blank"
        rel="noreferrer"
      >
        <Row sx={{ width: '100%' }} justifyContent="space-between">
          <Row gap={1}>
            <img src={etherscanIcon} alt="Etherscan" width={20} />
            <Typography variant="body1" color="text.primary">
              View on Etherscan
            </Typography>
          </Row>
          <ArrowForwardIcon
            sx={{
              transform: 'rotate(-45deg)',
              fontSize: '1rem',
              color: 'text.secondary',
            }}
          />
        </Row>
      </MenuItem>
      <MenuItem onClick={() => disconnect()}>
        <Row gap={1}>
          <img src={disconnectIcon} alt="Disconnect" width={20} />
          <Typography variant="body1" color="text.primary">
            Disconnect Wallet
          </Typography>
        </Row>
      </MenuItem>
      <Divider sx={{ mx: 1, borderColor: 'divider' }} />
      <Box sx={{ px: 1, pb: 0.25 }}>
        <Button
          fullWidth
          onClick={showPick}
          sx={{
            py: 1.25,
            color: BeanstalkPalette.brown,
            backgroundColor: BeanstalkPalette.lightBrown,
            '&:hover': {
              backgroundColor: BeanstalkPalette.lightBrown,
              opacity: 0.96,
            },
          }}
        >
          <Row>
            <Typography variant="h4">Pick Unripe Assets</Typography>
          </Row>
        </Button>
      </Box>
      <Box sx={{ px: 1, pt: 0.75, pb: 0.25 }}>
        <Button
          fullWidth
          color="primary"
          href="/#/chop"
          sx={{
            background: BeanstalkPalette.brown,
            py: 1.25,
            '&:hover': {
              background: BeanstalkPalette.darkBrown,
              opacity: 0.96,
            },
          }}
        >
          <Row alignItems="center">
            <Typography variant="h4">Chop Unripe Assets</Typography>
          </Row>
        </Button>
      </Box>
    </MenuList>
  );

  /// Connected
  return (
    <>
      {/* Wallet Button */}
      <FolderMenu
        buttonContent={
          <Typography
            variant="bodyMedium"
            display={{ xs: 'none', sm: 'block' }}
          >
            {/* Use `accountRaw` to match capitalization of wallet provider
             * assert existence of accountRaw.address since we check `account` prior. */}
            {trimAddress(IMPERSONATED_ACCOUNT || address || '')}
          </Typography>
        }
        startIcon={<AddressIcon address={account} />}
        popoverContent={menu}
        drawerContent={menu}
        onOpen={toggleMenuAnchor}
        onClose={toggleMenuAnchor}
        popperWidth="260px"
        hotkey="opt+2, alt+2"
        popoverPlacement="bottom-end"
        zeroTopRightRadius
        sx={
          import.meta.env.VITE_OVERRIDE_FARMER_ACCOUNT
            ? {
                color: 'text.primary',
                borderBottomColor: 'red',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                ...props.sx,
              }
            : props.sx
        }
      />
      {/* Pick Beans Dialog */}
      <PickBeansDialog open={picking} handleClose={hidePick} />
    </>
  );
};

export default WalletButton;
