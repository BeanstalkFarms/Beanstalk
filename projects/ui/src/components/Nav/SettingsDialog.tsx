import {
  Box,
  Button,
  ButtonGroup,
  IconButton,
  InputAdornment,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FC } from '~/types';
import { ethers } from 'ethers';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { DateTime } from 'luxon';
import React, { useCallback, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { DataSource } from '@beanstalk/sdk';
import { FontSize } from '~/components/App/muiTheme';
import {
  StyledDialog,
  StyledDialogContent,
  StyledDialogTitle,
} from '~/components/Common/Dialog';
import Row from '~/components/Common/Row';
import { SGEnvironments, SUBGRAPH_ENVIRONMENTS } from '~/graph/endpoints';
import useSetting from '~/hooks/app/useSetting';
import useFarmerSiloBalances from '~/hooks/farmer/useFarmerSiloBalances';
import { save } from '~/state';
import {
  setNextSunrise,
  setRemainingUntilSunrise,
} from '~/state/beanstalk/sun/actions';
import { clearApolloCache, trimAddress } from '~/util';
import useChainId from '~/hooks/chain/useChainId';
import { CHAIN_INFO } from '~/constants';
import { useAccount } from 'wagmi';
import OutputField from '../Common/Form/OutputField';

const Split: FC<{}> = ({ children }) => (
  <Row justifyContent="space-between" gap={1}>
    {children}
  </Row>
);

const buttonStyle = {
  variant: 'outlined' as const,
  color: 'dark' as const,
  size: 'small' as const,
  sx: { fontWeight: 400, color: 'text.primary' },
  disableElevation: true,
};

const buttonProps = <T extends any>(curr: T, set: (v: any) => void, v: T) => {
  if (curr === v) {
    return {
      color: 'primary' as const,
      onClick: undefined,
    };
  }
  return {
    onClick: () => set(v),
  };
};

const SelectInputProps = {
  sx: {
    py: 0.5,
    fontSize: FontSize.base,
  },
};

const SettingsDialog: FC<{ open: boolean; onClose?: () => void }> = ({
  open,
  onClose,
}) => {
  const chainId = useChainId();
  const [denomination, setDenomination] = useSetting('denomination');
  const [subgraphEnv, setSubgraphEnv] = useSetting('subgraphEnv');
  const [datasource, setDataSource] = useSetting('datasource');
  const [impersonatedAccount, setImpersonatedAccount] = useSetting(
    'impersonatedAccount'
  );
  const [internalAccount, setInternalAccount] = useState(impersonatedAccount);
  const [isAddressValid, setIsAddressValid] = useState<boolean | undefined>(
    undefined
  );
  const dispatch = useDispatch();
  const siloBalances = useFarmerSiloBalances();
  const account = useAccount();

  const checkAddress = useCallback(
    (address: string) => {
      if (address) {
        const isValid = ethers.utils.isAddress(address);
        if (isValid) {
          setInternalAccount(address);
        }
        setIsAddressValid(isValid);
      } else {
        setIsAddressValid(undefined);
      }
    },
    [setInternalAccount]
  );

  useMemo(() => {
    if (!account.address) {
      setInternalAccount('');
      setIsAddressValid(undefined);
      setImpersonatedAccount('');
    }
  }, [account.address, setImpersonatedAccount]);

  /// Cache
  const clearCache = useCallback(() => {
    clearApolloCache();
  }, []);
  const updateSubgraphEnv = useCallback(
    (env: SGEnvironments) => {
      setSubgraphEnv(env);
      save();
      clearApolloCache();
    },
    [setSubgraphEnv]
  );

  /// Dev Controls
  const setSeasonTimer = useCallback(() => {
    const _next = DateTime.now().plus({ second: 5 });
    dispatch(setNextSunrise(_next));
    dispatch(setRemainingUntilSunrise(_next.diffNow()));
  }, [dispatch]);
  const exportDepositsCSV = useCallback(() => {
    const rows = Object.keys(siloBalances).reduce(
      (prev, curr) => {
        prev.push(
          ...siloBalances[curr].deposited.crates.map((crate) => [
            curr,
            crate.amount,
            crate.bdv,
            crate.stem,
            crate.stalk.total,
            crate.stalk.base,
            crate.stalk.grown,
            crate.seeds,
          ])
        );
        return prev;
      },
      [
        [
          'Token',
          'Amount',
          'BDV',
          'Season',
          'Total Stalk',
          'Base Stalk',
          'Grown Stalk',
          'Seeds',
        ],
      ] as any[]
    );
    window.open(
      encodeURI(
        `data:text/csv;charset=utf-8,${rows.map((r) => r.join(',')).join('\n')}`
      )
    );
  }, [siloBalances]);

  const closeDialog = () => {
    if (impersonatedAccount !== internalAccount) {
      setImpersonatedAccount(internalAccount);
    }
    onClose && onClose();
  };

  return (
    <StyledDialog open={open} onClose={closeDialog}>
      <StyledDialogTitle onClose={closeDialog}>Settings</StyledDialogTitle>
      <StyledDialogContent sx={{ px: 2, pb: 2 }}>
        <Stack gap={2}>
          <Stack gap={1}>
            <Split>
              <Typography color="text.secondary">Fiat display</Typography>
              {/* @ts-ignore */}
              <ButtonGroup variant="outlined" color="dark" disableRipple>
                <Button
                  {...buttonStyle}
                  {...buttonProps(denomination, setDenomination, 'usd')}
                >
                  {denomination === 'usd' ? '✓ ' : undefined}USD
                </Button>
                <Button
                  {...buttonStyle}
                  {...buttonProps(denomination, setDenomination, 'bdv')}
                >
                  {denomination === 'bdv' ? '✓ ' : undefined}BDV
                </Button>
              </ButtonGroup>
            </Split>
            <Split>
              <Typography color="text.secondary">Subgraph</Typography>
              <Box>
                <Select
                  value={subgraphEnv || SGEnvironments.BF_PROD}
                  size="small"
                  onChange={(e) =>
                    updateSubgraphEnv(e.target.value as SGEnvironments)
                  }
                  inputProps={SelectInputProps}
                >
                  {Object.values(SGEnvironments).map((value) => (
                    <MenuItem key={value} value={value}>
                      {SUBGRAPH_ENVIRONMENTS[value as SGEnvironments]?.name ||
                        'Unknown'}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            </Split>
            <Split>
              <Typography color="text.secondary">Data source</Typography>
              {/* @ts-ignore */}
              <ButtonGroup variant="outlined" color="dark" disableRipple>
                <Button
                  {...buttonStyle}
                  {...buttonProps(datasource, setDataSource, DataSource.LEDGER)}
                >
                  {datasource === DataSource.LEDGER ? '✓ ' : undefined}
                  Blockchain
                </Button>
                <Button
                  {...buttonStyle}
                  {...buttonProps(
                    datasource,
                    setDataSource,
                    DataSource.SUBGRAPH
                  )}
                >
                  {datasource === DataSource.SUBGRAPH ? '✓ ' : undefined}
                  Subgraph
                </Button>
              </ButtonGroup>
            </Split>
            <Split>
              <Typography color="text.secondary">
                Impersonate Account
              </Typography>
              {internalAccount ? (
                <OutputField size="small">
                  <Row spacing={1}>
                    <CheckIcon
                      sx={{ height: 20, width: 20, fontSize: '100%' }}
                      color="primary"
                    />
                    <Typography>
                      <Tooltip title="View on Etherscan">
                        <Link
                          underline="hover"
                          color="text.primary"
                          href={`${CHAIN_INFO[chainId].explorer}/address/${internalAccount}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {trimAddress(internalAccount)}
                        </Link>
                      </Tooltip>
                    </Typography>
                  </Row>
                  <Box>
                    <IconButton
                      onClick={() => {
                        setInternalAccount('');
                      }}
                    >
                      <CloseIcon
                        sx={{ height: 20, width: 20, fontSize: '100%' }}
                      />
                    </IconButton>
                  </Box>
                </OutputField>
              ) : (
                <TextField
                  sx={{ width: 180 }}
                  placeholder="0x0000"
                  size="small"
                  color="primary"
                  InputProps={{
                    startAdornment: isAddressValid === false && (
                      <InputAdornment position="start" sx={{ ml: -1, mr: 0 }}>
                        <CloseIcon color="warning" sx={{ scale: '80%' }} />
                      </InputAdornment>
                    ),
                  }}
                  onChange={(e) => {
                    checkAddress(e.target.value);
                  }}
                />
              )}
            </Split>
            <Split>
              <Typography color="text.secondary">Clear cache</Typography>
              <Button {...buttonStyle} onClick={clearCache}>
                Clear
              </Button>
            </Split>
          </Stack>
          <Stack gap={1}>
            <Typography variant="h4">Info</Typography>
            <Split>
              <Typography color="text.secondary">Version</Typography>
              <Box>
                {(import.meta.env.VITE_COMMIT_HASH || '0.0.0').substring(0, 6)}
              </Box>
            </Split>
            <Split>
              <Typography color="text.secondary">Commit</Typography>
              <Box>
                {import.meta.env.VITE_GIT_COMMIT_REF?.slice(0, 6) || 'HEAD'}
              </Box>
            </Split>
            <Split>
              <Typography color="text.secondary">Host</Typography>
              <Box>{import.meta.env.VITE_HOST || 'unknown'}</Box>
            </Split>
          </Stack>
          {import.meta.env.DEV ? (
            <>
              <Stack gap={1}>
                <Typography variant="h4">Dev Controls</Typography>
                <Split>
                  <Typography color="text.secondary">
                    Set Season timer
                  </Typography>
                  <Button {...buttonStyle} onClick={setSeasonTimer}>
                    in 5s
                  </Button>
                </Split>
                <Split>
                  <Typography color="text.secondary">
                    Export Deposits
                  </Typography>
                  <Button {...buttonStyle} onClick={exportDepositsCSV}>
                    Export
                  </Button>
                </Split>
              </Stack>
            </>
          ) : null}
        </Stack>
      </StyledDialogContent>
    </StyledDialog>
  );
};

export default SettingsDialog;
