import React, { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  Container,
  Dialog,
  Divider,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import useAccount from '../hooks/ledger/useAccount';
import PageHeader from '~/components/Common/PageHeader';
import Row from '~/components/Common/Row';
import { FC } from '~/types';
import { useParams } from 'react-router-dom';
import { ethers } from 'ethers';
import { TokenValue } from '@beanstalk/sdk-core';
import useSdk from '~/hooks/sdk';
import { BeanstalkPalette, IconSize } from '~/components/App/muiTheme';
import {
  StyledDialogContent,
  StyledDialogTitle,
} from '~/components/Common/Dialog';
import TokenIcon from '~/components/Common/TokenIcon';
import useHarvestableIndex from '~/hooks/beanstalk/useHarvestableIndex';

const MigrationPreview: FC<{}> = () => {
  const connectedAccount = useAccount();
  const { address: accountUrl } = useParams();
  const theme = useTheme();
  const [isAccountValid, setIsAccountValid] = useState(false);
  const [account, setAccount] = useState<string | undefined>();
  const [data, setData] = useState<any>();
  const [openDialog, setOpenDialog] = useState(false);

  const sdk = useSdk();

  const BEAN = sdk.tokens.BEAN;
  const PODS = sdk.tokens.PODS;

  const harvestableIndex = TokenValue.fromHuman(useHarvestableIndex()?.toString() || "0", PODS.decimals);

  useEffect(() => {
    if (accountUrl) {
      validateAddress(accountUrl);
      getMigrationData();
    }
  }, []);

  function validateAddress(address: string) {
    setAccount(address);
    if (address) {
      const isValid = ethers.utils.isAddress(address);
      setIsAccountValid(isValid);
    } else {
      setIsAccountValid(false);
    }
  }

  function useConnectedWallet() {
    if (!connectedAccount) return;
    validateAddress(connectedAccount);
    getMigrationData();
  }

  async function getMigrationData() {
    const _account = account || accountUrl;
    const _isValid = account
      ? isAccountValid
      : ethers.utils.isAddress(accountUrl || '');
    if (!_account || !_isValid) return;
    try {
      const migrationData = await fetch(
        `https://api.bean.money/migration?account=${_account}`
      ).then((response) => response.json());
      if (migrationData) {
        const totalPerToken: any[] = [];
        migrationData.silo.deposits.forEach(
          (deposit: any, index: number, deposits: any[]) => {
            const _token = Array.from(
              sdk.tokens.getMap(),
              ([key, value]) => value
            ).find(
              (token) =>
                token.displayName.toLowerCase() === deposit.token.toLowerCase()
            );
            const _amount = TokenValue.fromBlockchain(
              deposit.amount,
              _token?.decimals || 6
            );
            const _recordedBdv = TokenValue.fromBlockchain(
              deposit.recordedBdv,
              BEAN.decimals
            );
            const _currentStalk = TokenValue.fromBlockchain(
              deposit.currentStalk,
              16
            );
            const _stalkAfterMow = TokenValue.fromBlockchain(
              deposit.stalkAfterMow,
              16
            );
            const _deposit = {
              token: _token,
              amount: _amount,
              recordedBdv: _recordedBdv,
              currentStalk: _currentStalk,
              stalkAfterMow: _stalkAfterMow,
            };
            deposits[index] = _deposit;
            const totalIndex = totalPerToken.findIndex(
              (token) => token.token.displayName === _token?.displayName
            );
            if (totalIndex === -1) {
              const total = {
                token: _token,
                amount: _amount,
              };
              totalPerToken.push(total);
            } else {
              totalPerToken[totalIndex].amount = _amount.add(
                totalPerToken[totalIndex].amount
              );
            }
          }
        );
        migrationData.silo.currentStalk = TokenValue.fromBlockchain(
          migrationData.silo.currentStalk,
          16
        );
        migrationData.silo.earnedBeans = TokenValue.fromBlockchain(
          migrationData.silo.earnedBeans,
          BEAN.decimals
        );
        migrationData.silo.stalkAfterMow = TokenValue.fromBlockchain(
          migrationData.silo.stalkAfterMow,
          16
        );
        migrationData.silo.totalPerToken = totalPerToken;
        migrationData.field.totalPods = TokenValue.fromBlockchain(
          migrationData.field.totalPods,
          BEAN.decimals
        );
        migrationData.barn.totalFert = TokenValue.fromBlockchain(
          migrationData.barn.totalFert,
          0
        );
        migrationData.barn.totalRinsable = TokenValue.fromBlockchain(
          migrationData.barn.totalRinsable,
          BEAN.decimals
        );
        migrationData.barn.totalUnrinsable = TokenValue.fromBlockchain(
          migrationData.barn.totalUnrinsable,
          BEAN.decimals
        );
        migrationData.farm.forEach((token: any, index: number, farm: any[]) => {
          const _token = Array.from(
            sdk.tokens.getMap(),
            ([key, value]) => value
          ).find(
            (tokenMap) =>
              tokenMap.displayName.toLowerCase() === token.token.toLowerCase()
          );
          const _currentInternal = TokenValue.fromBlockchain(
            token.currentInternal,
            _token?.decimals || 6
          );
          const _withdrawn = TokenValue.fromBlockchain(
            token.withdrawn,
            _token?.decimals || 6
          );
          const _unpicked = TokenValue.fromBlockchain(
            token.unpicked,
            _token?.decimals || 6
          );
          const _rinsable = TokenValue.fromBlockchain(
            token.rinsable,
            _token?.decimals || 6
          );
          const _total = TokenValue.fromBlockchain(
            token.total,
            _token?.decimals || 6
          );
          const farmData = {
            token: _token,
            currentInternal: _currentInternal,
            withdrawn: _withdrawn,
            unpicked: _unpicked,
            rinsable: _rinsable,
            total: _total,
          };
          farm[index] = farmData;
        });
        setData(migrationData);
      }
    } catch (e) {
      console.error('Migration Preview - Error Fetching Data');
    }
  }

  return (
    <Container maxWidth="lg">
      <Stack spacing={2}>
        <PageHeader
          title="Verify BIP-50 Migrated Balances"
          description="Preview an account's assets after migration"
        />
        <Card sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', flexGrow: 1, justifyContent: 'center' }}>
            <Stack gap={1.5} maxWidth={640} flexGrow={1}>
              <Row
                justifyContent="center"
                alignItems="center"
                gap={2}
                sx={{ px: 0.5 }}
              >
                <Typography fontSize={20}>Enter Address</Typography>
                <TextField
                  sx={{ flexGrow: 1 }}
                  placeholder="0x0000"
                  size="medium"
                  color="primary"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment
                        position="start"
                        sx={{ ml: account ? -1 : 0, mr: 0 }}
                      >
                        {account && !isAccountValid && (
                          <CloseIcon
                            sx={{ height: 40, width: 40, fontSize: '100%' }}
                            color="warning"
                          />
                        )}
                        {account && isAccountValid && (
                          <CheckIcon
                            sx={{ height: 40, width: 40, fontSize: '100%' }}
                            color="primary"
                          />
                        )}
                      </InputAdornment>
                    ),
                  }}
                  value={account}
                  onChange={(e) => {
                    validateAddress(e.target.value);
                  }}
                />
              </Row>
              <Row
                justifyContent="center"
                alignItems="center"
                gap={2}
                sx={{ px: 0.5 }}
              >
                <Button
                  size="large"
                  fullWidth
                  onClick={() => getMigrationData()}
                >
                  Submit
                </Button>
                <Button
                  size="large"
                  fullWidth
                  disabled={!connectedAccount}
                  onClick={() => useConnectedWallet()}
                >
                  Use Connected Wallet
                </Button>
              </Row>
            </Stack>
          </Box>
        </Card>
        {data && (
          <>
            <Button color="info" onClick={() => setOpenDialog(true)}>
              About this page, BIP-50, the Migration process and your Balances
            </Button>
            <Dialog onClose={() => setOpenDialog(false)} open={openDialog}>
              <StyledDialogTitle onClose={() => setOpenDialog(false)}>
                BIP-50 Balance Migration
              </StyledDialogTitle>
              <StyledDialogContent
                sx={{
                  pb: 2,
                  px: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <div>
                  BIP-50 proposes to <b>migrate Beanstalk state to Arbitrum.</b>{' '}
                  In doing so,{' '}
                  <b>
                    all Deposits, Plots, Fertilizer and Beanstalk-related Farm
                    Balances
                  </b>{' '}
                  (Beans, BEANWETH, BEAN3CRV (migrated to BEANUSDC), BEANwstETH,
                  urBEAN and urBEANwstETH) <b>are migrated.</b>
                </div>
                <div>
                  <b>As part of the migration process:</b>
                  <ul>
                    <li>
                      <b>Grown Stalk is Mown;</b>
                    </li>
                    <li>
                      <b>Earned Beans are Planted;</b> and
                    </li>
                    <li>
                      <b>
                        Rinsable Sprouts, Unpicked Unripe assets and unclaimed
                        Silo V2 Withdrawals
                      </b>{' '}
                      are put into the respective{' '}
                      <b>accounts' Farm Balances.</b>
                    </li>
                  </ul>
                </div>
                <div>
                  The following balances show the state of the selected Farmer
                  as a result of the migration,{' '}
                  <b>
                    assuming the migration was executed based on balances at
                    block {data.meta.block} (i.e., roughly
                    {` ${new Date(data.meta.timestamp * 1000).toLocaleString()}`}
                    ).{' '}
                  </b>
                  You should cross reference this with your balances in the rest
                  of the Beanstalk UI (assuming your balances haven't changed
                  since block {data.meta.block}).
                </div>
                <div>
                  Note that{' '}
                  <b>
                    Circulating Balances and smart contract account balances are
                    not migrated automatically.
                  </b>{' '}
                  See <a href="https://discord.gg/beanstalk">Discord</a>
                  &nbsp;and{' '}
                  <a href="https://github.com/BeanstalkFarms/Beanstalk/pull/909">
                    BIP-50
                  </a>{' '}
                  for more information.
                </div>
              </StyledDialogContent>
            </Dialog>
            <Card sx={{ p: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                <Typography variant="h2">Silo</Typography>
                <Typography
                  variant="h4"
                  fontSize={16}
                >{`(as of ${new Date(data.meta.timestamp * 1000).toLocaleString()})`}</Typography>
              </Box>
              {data.silo.earnedBeans.gt(0) ||
              data.silo.currentStalk.gt(0) ||
              data.silo.stalkAfterMow.gt(0) ||
              (data.silo.totalPerToken &&
                data.silo.totalPerToken.length > 0) ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      gap: 2,
                      marginTop: 2,
                    }}
                  >
                    <Box>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'row',
                          gap: 0.25,
                        }}
                      >
                        <Typography fontSize={18}>Earned Beans</Typography>
                        <Tooltip
                          title={'Earned Beans will be automatically Planted.'}
                          placement={'right'}
                        >
                          <HelpOutlineIcon
                            sx={{
                              color: 'text.secondary',
                              display: 'inline',
                              mb: 0.5,
                              fontSize: '11px',
                            }}
                          />
                        </Tooltip>
                      </Box>
                      <Typography fontSize={20} variant="h4">
                        {data.silo.earnedBeans.toHuman('short')}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography fontSize={18}>Current Stalk</Typography>
                      <Typography fontSize={20} variant="h4">
                        {data.silo.currentStalk.toHuman('short')}
                      </Typography>
                    </Box>
                    <ArrowForwardIcon sx={{ marginTop: 0.75 }} />
                    <Box>
                      <Typography fontSize={18}>Stalk After Mow</Typography>
                      <Typography
                        fontSize={20}
                        variant="h4"
                        color={
                          data.silo.stalkAfterMow.gt(data.silo.currentStalk)
                            ? 'primary'
                            : undefined
                        }
                      >
                        {data.silo.stalkAfterMow.toHuman('short')}
                      </Typography>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography fontSize={18} fontWeight={700}>
                        Deposited Tokens
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'row',
                          gap: 2,
                          marginTop: 1,
                        }}
                      >
                        {data.silo.totalPerToken &&
                          data.silo.totalPerToken.map(
                            (tokenData: any, index: number, array: any[]) => (
                              <>
                                <Box>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 0.75,
                                    }}
                                  >
                                    <TokenIcon token={tokenData.token} />
                                    <Typography fontSize={18}>
                                      {tokenData.token.displayName}
                                    </Typography>
                                  </Box>
                                  <Typography fontSize={20} variant={'h4'}>
                                    {tokenData.amount.toHuman('short')}
                                  </Typography>
                                </Box>
                                {index !== array.length - 1 && <Divider />}
                              </>
                            )
                          )}
                      </Box>
                    </Box>
                  </Box>
                  {data.silo.deposits.length > 0 && (
                    <Accordion
                      variant="elevation"
                      key={'siloMigration'}
                      sx={{
                        '::before': { display: 'none' },
                        border: `1px solid ${BeanstalkPalette.blue}`,
                        borderRadius: 1,
                      }}
                    >
                      <AccordionSummary
                        expandIcon={
                          <ExpandMoreIcon
                            sx={{
                              color: 'primary.main',
                              fontSize: IconSize.xs,
                            }}
                          />
                        }
                      >
                        View Deposits
                      </AccordionSummary>
                      <AccordionDetails sx={{ py: 0, px: 2, pb: 2 }}>
                        <TableContainer component={Card}>
                          <Table size="small" aria-label="simple table">
                            <TableHead>
                              <TableRow
                                sx={{
                                  th: {
                                    borderBottom: 0.5,
                                    borderColor: BeanstalkPalette.blue,
                                  },
                                }}
                              >
                                <TableCell>Token</TableCell>
                                <TableCell align="right">Amount</TableCell>
                                <TableCell align="right">
                                  Recorded BDV
                                </TableCell>
                                <TableCell align="right">
                                  Current Stalk
                                </TableCell>
                                <TableCell align="right">
                                  Stalk After Mow
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {data.silo.deposits.map(
                                (deposit: any, i: number) => {
                                  const stalkIncrease =
                                    deposit.stalkAfterMow.gt(
                                      deposit.currentStalk
                                    );
                                  return (
                                    <TableRow
                                      key={`deposit-${i}`}
                                      sx={{
                                        'td, th': {
                                          borderBottom: 0.5,
                                          borderColor: BeanstalkPalette.blue,
                                        },
                                        '&:last-child td, &:last-child th': {
                                          border: 0,
                                        },
                                      }}
                                    >
                                      <TableCell
                                        component="th"
                                        scope="row"
                                        sx={{
                                          display: 'flex',
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          gap: 0.75,
                                        }}
                                      >
                                        <TokenIcon token={deposit.token} />
                                        <div>{deposit.token.displayName}</div>
                                      </TableCell>
                                      <TableCell align="right">
                                        {deposit.amount.toHuman('short')}
                                      </TableCell>
                                      <TableCell align="right">
                                        {deposit.recordedBdv.toHuman('short')}
                                      </TableCell>
                                      <TableCell align="right">
                                        {deposit.currentStalk.toHuman('short')}
                                      </TableCell>
                                      <TableCell align="right">
                                        <Typography
                                          color={
                                            stalkIncrease
                                              ? 'primary'
                                              : undefined
                                          }
                                        >
                                          {deposit.stalkAfterMow.toHuman(
                                            'short'
                                          )}
                                        </Typography>
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </Box>
              ) : (
                <Box sx={{ marginTop: 2 }}>
                  This account has no assets in the Silo.
                </Box>
              )}
            </Card>
            <Card sx={{ p: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                <Typography variant="h2">Field</Typography>
                <Typography
                  variant="h4"
                  fontSize={16}
                >{`(as of ${new Date(data.meta.timestamp * 1000).toLocaleString()})`}</Typography>
              </Box>
              {data.field.totalPods.gt(0) ||
              (data.field.plots && data.field.plots.length > 0) ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      gap: 2,
                      marginTop: 2,
                    }}
                  >
                    <Box>
                      <Typography fontSize={18}>Total Pods</Typography>
                      <Typography fontSize={20} variant="h4">
                        {data.field.totalPods.toHuman('short')}
                      </Typography>
                    </Box>
                  </Box>
                  {data.field.plots.length > 0 && (
                    <Accordion
                      variant="elevation"
                      key={'fieldMigration'}
                      sx={{
                        '::before': { display: 'none' },
                        border: `1px solid ${BeanstalkPalette.blue}`,
                        borderRadius: 1,
                      }}
                    >
                      <AccordionSummary
                        expandIcon={
                          <ExpandMoreIcon
                            sx={{
                              color: 'primary.main',
                              fontSize: IconSize.xs,
                            }}
                          />
                        }
                      >
                        View Plots
                      </AccordionSummary>
                      <AccordionDetails sx={{ py: 0, px: 2, pb: 2 }}>
                        <TableContainer component={Card}>
                          <Table size="small" aria-label="simple table">
                            <TableHead>
                              <TableRow
                                sx={{
                                  th: {
                                    borderBottom: 0.5,
                                    borderColor: BeanstalkPalette.blue,
                                  },
                                }}
                              >
                                <TableCell>Place In Line</TableCell>
                                <TableCell align="right">Amount</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {data.field.plots.map((plot: any, i: number) => (
                                <TableRow
                                  key={`plot-${i}`}
                                  sx={{
                                    'td, th': {
                                      borderBottom: 0.5,
                                      borderColor: BeanstalkPalette.blue,
                                    },
                                    '&:last-child td, &:last-child th': {
                                      border: 0,
                                    },
                                  }}
                                >
                                  <TableCell component="th" scope="row">
                                    {(TokenValue.fromBlockchain(
                                      plot.index,
                                      6
                                    )).sub(harvestableIndex).toHuman('short')}
                                  </TableCell>
                                  <TableCell align="right">
                                    {TokenValue.fromBlockchain(
                                      plot.amount,
                                      6
                                    ).toHuman('short')}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </Box>
              ) : (
                <Box sx={{ marginTop: 2 }}>
                  This account has no assets in the Field.
                </Box>
              )}
            </Card>
            <Card sx={{ p: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                <Typography variant="h2">Barn</Typography>
                <Typography
                  variant="h4"
                  fontSize={16}
                >{`(as of ${new Date(data.meta.timestamp * 1000).toLocaleString()})`}</Typography>
              </Box>
              {data.barn.totalFert.gt(0) ||
              data.barn.totalRinsable.gt(0) ||
              data.barn.totalUnrinsable.gt(0) ||
              (data.barn.fert && data.barn.fert.length > 0) ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      gap: 2,
                      marginTop: 2,
                    }}
                  >
                    <Box>
                      <Typography fontSize={18}>Total Fertilizer</Typography>
                      <Typography fontSize={20} variant="h4">
                        {data.barn.totalFert.toHuman('short')}
                      </Typography>
                    </Box>
                    <Box>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'row',
                          gap: 0.25,
                        }}
                      >
                        <Typography fontSize={18}>Rinsable Sprouts</Typography>
                        <Tooltip
                          title={
                            'Rinsable Sprouts will be sent to Farm Balance.'
                          }
                          placement={'right'}
                        >
                          <HelpOutlineIcon
                            sx={{
                              color: 'text.secondary',
                              display: 'inline',
                              mb: 0.5,
                              fontSize: '11px',
                            }}
                          />
                        </Tooltip>
                      </Box>
                      <Typography fontSize={18}></Typography>
                      <Typography fontSize={20} variant="h4">
                        {data.barn.totalRinsable.toHuman('short')}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography fontSize={18}>Unrinsable Sprouts</Typography>
                      <Typography fontSize={20} variant="h4">
                        {data.barn.totalUnrinsable.toHuman('short')}
                      </Typography>
                    </Box>
                  </Box>
                  {data.barn.fert.length > 0 && (
                    <Accordion
                      variant="elevation"
                      key={'barnMigration'}
                      sx={{
                        '::before': { display: 'none' },
                        border: `1px solid ${BeanstalkPalette.blue}`,
                        borderRadius: 1,
                      }}
                    >
                      <AccordionSummary
                        expandIcon={
                          <ExpandMoreIcon
                            sx={{
                              color: 'primary.main',
                              fontSize: IconSize.xs,
                            }}
                          />
                        }
                      >
                        View Fertilizer
                      </AccordionSummary>
                      <AccordionDetails sx={{ py: 0, px: 2, pb: 2 }}>
                        <TableContainer component={Card}>
                          <Table size="small" aria-label="simple table">
                            <TableHead>
                              <TableRow
                                sx={{
                                  th: {
                                    borderBottom: 0.5,
                                    borderColor: BeanstalkPalette.blue,
                                  },
                                }}
                              >
                                <TableCell>ID</TableCell>
                                <TableCell align="right">Amount</TableCell>
                                <TableCell align="right">
                                  Rinsable Sprouts
                                </TableCell>
                                <TableCell align="right">
                                  Unrinsable Sprouts
                                </TableCell>
                                <TableCell align="right">Humidity</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {data.barn.fert.map((fert: any, i: number) => (
                                <TableRow
                                  key={`fert-${i}`}
                                  sx={{
                                    'td, th': {
                                      borderBottom: 0.5,
                                      borderColor: BeanstalkPalette.blue,
                                    },
                                    '&:last-child td, &:last-child th': {
                                      border: 0,
                                    },
                                  }}
                                >
                                  <TableCell component="th" scope="row">
                                    {Number(fert.fertilizerId)}
                                  </TableCell>
                                  <TableCell align="right">
                                    {TokenValue.fromBlockchain(
                                      fert.amount,
                                      0
                                    ).toHuman('short')}
                                  </TableCell>
                                  <TableCell align="right">
                                    {TokenValue.fromBlockchain(
                                      fert.rinsableSprouts,
                                      6
                                    ).toHuman('short')}
                                  </TableCell>
                                  <TableCell align="right">
                                    {TokenValue.fromBlockchain(
                                      fert.unrinsableSprouts,
                                      6
                                    ).toHuman('short')}
                                  </TableCell>
                                  <TableCell align="right">{`${fert.humidity * 100}%`}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </Box>
              ) : (
                <Box sx={{ marginTop: 2 }}>
                  This account has no assets in the Barn.
                </Box>
              )}
            </Card>
            <Card sx={{ p: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                <Typography variant="h2">Farm</Typography>
                <Typography
                  variant="h4"
                  fontSize={16}
                >{`(as of ${new Date(data.meta.timestamp * 1000).toLocaleString()})`}</Typography>
              </Box>
              <Box sx={{ marginTop: 2 }}>
                {data.farm.length > 0 ? (
                  <TableContainer component={Card}>
                    <Table size="small" aria-label="simple table">
                      <TableHead>
                        <TableRow
                          sx={{
                            th: {
                              borderBottom: 0.5,
                              borderColor: BeanstalkPalette.blue,
                            },
                          }}
                        >
                          <TableCell>Token</TableCell>
                          <TableCell align="right">Internal Balance</TableCell>
                          <TableCell align="right">Withdrawn</TableCell>
                          <TableCell align="right">Unpicked</TableCell>
                          <TableCell align="right">Rinsable</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.farm.map((farmData: any, i: number) => {
                          return (
                            <TableRow
                              key={`fert-${i}`}
                              sx={{
                                'td, th': {
                                  borderBottom: 0.5,
                                  borderColor: BeanstalkPalette.blue,
                                },
                                '&:last-child td, &:last-child th': {
                                  border: 0,
                                },
                              }}
                            >
                              <TableCell
                                component="th"
                                scope="row"
                                sx={{
                                  display: 'flex',
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 0.75,
                                }}
                              >
                                <TokenIcon token={farmData.token} />
                                <div>{farmData.token.displayName}</div>
                              </TableCell>
                              <TableCell align="right">
                                {farmData.currentInternal.toHuman('short')}
                              </TableCell>
                              <TableCell align="right">
                                {farmData.withdrawn.toHuman('short')}
                              </TableCell>
                              <TableCell align="right">
                                {farmData.token.isUnripe ? farmData.unpicked.toHuman('short') : '-'}
                              </TableCell>
                              <TableCell align="right">
                                {farmData.token.displayName === "Bean" ? farmData.rinsable.toHuman('short') : '-'}
                              </TableCell>
                              <TableCell align="right">
                                {farmData.total.toHuman('short')}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Box>This account has no Farm Balances to be migrated.</Box>
                )}
              </Box>
            </Card>
          </>
        )}
      </Stack>
    </Container>
  );
};

export default MigrationPreview;
