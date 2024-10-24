import React from 'react';
import { useAccount } from 'wagmi';
import { Button, ButtonProps, Typography } from '@mui/material';
import useAnchor from '~/hooks/display/useAnchor';
import { SupportedChainId } from '~/constants/chains';
import useChainState from '~/hooks/chain/useChainState';
import { useTokens } from '~/hooks/beanstalk/useTokens';
import TokenIcon from '../TokenIcon';
import DropdownIcon from '../DropdownIcon';
import NetworkDialog from './NetworkDialog';

const NetworkIcon = () => {
  const { isEthereum } = useChainState();
  const { ETH, ARB } = useTokens();
  const networkToken = isEthereum ? ETH : ARB;

  return <TokenIcon token={networkToken} css={{ height: '1.4em' }} />;
};

const NetworkButton: React.FC<
  ButtonProps & {
    showIcons?: boolean;
    wrongNetworkText?: string;
  }
> = ({
  showIcons = true,
  wrongNetworkText = 'Switch Network',
  children,
  ...props
}) => {
  const { isTestnet } = useChainState();
  const { chain } = useAccount();

  /// Dialog
  const [anchor, toggleAnchor] = useAnchor();
  const open = Boolean(anchor);

  if (!chain) return null;
  const text = SupportedChainId[chain.id] ? chain.name : wrongNetworkText;

  return (
    <>
      <Button
        disableFocusRipple
        variant="contained"
        color="light"
        startIcon={showIcons && <NetworkIcon />}
        endIcon={showIcons && <DropdownIcon open={open} />}
        onClick={toggleAnchor}
        {...props}
        sx={{
          // MUI adds a default margin to start and
          // end icons to give them space between text.
          // When we hide the text below, we also remove the
          // margin so the network icon appears closer to the
          // dropdown icon.
          px: {
            // md: 1.5,    // FIXME: couldn't get 'inherit' to work here
            // xs: 0,
          },
          '& .MuiButton-startIcon': {
            marginRight: {
              md: 0.8, // FIXME: couldn't get 'inherit' to work here
              xs: 0,
            },
          },
          borderStyle: 'solid',
          borderColor: 'white',
          borderWidth: 1,
          transition: 'none !important',
          '&:hover': {
            borderColor: 'divider',
          },
          // Follow similar pattern as WalletButton & show red bottom border if we are on localhost
          ...(isTestnet ? { borderBottom: '2px solid red' } : {}),
          ...props.sx,
        }}
      >
        {children || (
          <Typography
            variant="bodyMedium"
            sx={{ display: { xl: 'block', xs: 'none' }, color: 'text.primary' }}
          >
            {text}
          </Typography>
        )}
      </Button>
      <NetworkDialog
        open={open}
        // toggling always removes the anchor when open === true
        handleClose={toggleAnchor}
      />
    </>
  );
};

export default NetworkButton;
