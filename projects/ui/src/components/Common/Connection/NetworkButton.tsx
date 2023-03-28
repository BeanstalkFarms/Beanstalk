import React from 'react';
import { useNetwork } from 'wagmi';
import { Button, ButtonProps, Typography } from '@mui/material';
import useAnchor from '~/hooks/display/useAnchor';
import { SupportedChainId } from '~/constants/chains';
import { ETH } from '~/constants/tokens';
import TokenIcon from '../TokenIcon';
import DropdownIcon from '../DropdownIcon';
import NetworkDialog from './NetworkDialog';

const NetworkButton: React.FC<ButtonProps & {
  showIcons?: boolean;
  wrongNetworkText?: string;
}> = ({ 
  showIcons = true,
  wrongNetworkText = 'Switch Network',
  children,
  ...props
}) => {
  const { chain } = useNetwork();

  /// Dialog
  const [anchor, toggleAnchor] = useAnchor();
  const open = Boolean(anchor);
  
  if (!chain) return null;
  const text = (
    SupportedChainId[chain.id]
      ? chain.name 
      : wrongNetworkText
  );
  
  return (
    <>
      <Button
        disableFocusRipple
        variant="contained"
        color="light"
        startIcon={showIcons && (
          <TokenIcon
            token={ETH[SupportedChainId.MAINNET]}
            css={{ height: '1.4em' }}
          />
        )}
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
              md: 0.8,  // FIXME: couldn't get 'inherit' to work here
              xs: 0
            }
          },
          ...props.sx
        }}
      >
        {children || (
          <Typography variant="bodyMedium" sx={{ display: { xl: 'block', xs: 'none' }, color: 'text.primary' }}>
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
