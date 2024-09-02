import React, { useCallback } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import {
  Alert,
  Button,
  Dialog,
  DialogProps,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { SWITCH_NETWORK_ERRORS } from '~/constants/wallets';
import { SupportedChainId, TESTNET_RPC_ADDRESSES } from '~/constants';
import Row from '~/components/Common/Row';
import { useTokens } from '~/hooks/beanstalk/useTokens';
import { Address } from '@beanstalk/sdk-core';
import { StyledDialogContent, StyledDialogTitle } from '../Dialog';

const useChainIdToLogo = () => {
  const { ETH, ARB } = useTokens();

  return useCallback(
    (_chainId: SupportedChainId | undefined) => {
      const chainId = _chainId || Address.defaultChainId;
      if (
        chainId === SupportedChainId.LOCALHOST_MAINNET ||
        chainId === SupportedChainId.MAINNET
      ) {
        return ETH.logo;
      }
      return ARB.logo;
    },
    [ETH, ARB]
  );
};

const NetworkDialog: React.FC<
  DialogProps & {
    open: boolean;
    handleClose?: () => void;
  }
> = ({ open, handleClose, ...props }) => {
  /// Theme
  const theme = useTheme();
  const isMedium = useMediaQuery(theme.breakpoints.down('md'));

  const getLogoWithChainId = useChainIdToLogo();

  ///
  const { chain: _chain } = useAccount();
  const { chains, error, isPending, switchChain } = useSwitchChain();
  const handleSwitch = useCallback(
    (id: number) => () => {
      if (switchChain) {
        console.debug(`[NetworkButton] switching network => ${id}`);
        switchChain({ chainId: id });
        handleClose?.();
      }
    },
    [switchChain, handleClose]
  );

  return (
    <Dialog onClose={handleClose} open={open} {...props}>
      <StyledDialogTitle onClose={handleClose}>
        Select Network
      </StyledDialogTitle>
      <StyledDialogContent>
        <Stack gap={1}>
          {_chain?.id && !SupportedChainId[_chain.id] ? (
            <Alert severity="info">
              {_chain.name} is not supported. Please select another network
              below.
            </Alert>
          ) : null}
          {chains.map((chain) => (
            <Button
              key={chain.id}
              size="large"
              variant="outlined"
              color="light"
              onClick={handleSwitch(chain.id)}
              sx={{
                py: 1,
                minWidth: isMedium ? null : 400,
                // borderColor: grey[300],
                // '&:hover': {
                //   borderColor: 'primary.main',
                // }
              }}
            >
              <Row
                justifyContent="space-between"
                sx={{ width: '100%' }}
                gap={3}
              >
                <Typography color="text.primary" sx={{ fontSize: 20 }}>
                  {chain.name}
                </Typography>
                {TESTNET_RPC_ADDRESSES[chain.id] ? (
                  <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                    {TESTNET_RPC_ADDRESSES[chain.id]}
                  </Typography>
                ) : (
                  <img
                    src={getLogoWithChainId(chain.id)}
                    alt=""
                    style={{ height: 35 }}
                  />
                )}
              </Row>
            </Button>
          ))}
          {error && (
            <Alert severity="error">
              {/* @ts-ignore */}
              {SWITCH_NETWORK_ERRORS[error.name || error.message](isPending) ||
                error.message}
            </Alert>
          )}
        </Stack>
      </StyledDialogContent>
    </Dialog>
  );
};

export default NetworkDialog;
