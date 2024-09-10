import React, { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  Container,
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
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import useAccount from '../hooks/ledger/useAccount';
import PageHeader from '~/components/Common/PageHeader';
import GuideButton from '~/components/Common/Guide/GuideButton';
import { HOW_TO_MINT_BEANFTS } from '~/util/Guides';
import Row from '~/components/Common/Row';
import { FC } from '~/types';
import { useParams } from 'react-router-dom';
import { ethers } from 'ethers';
import { TokenValue } from '@beanstalk/sdk-core';
import useSdk from '~/hooks/sdk';
import { BeanstalkPalette, IconSize } from '~/components/App/muiTheme';

const MigrationPreview: FC<{}> = () => {
  const connectedAccount = useAccount();
  const { address: accountUrl } = useParams();
  const theme = useTheme();
  const [isAccountValid, setIsAccountValid] = useState(false);
  const [account, setAccount] = useState<string | undefined>();
  const [data, setData] = useState<any>();

  const sdk = useSdk();

  const BEAN = sdk.tokens.BEAN;

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
        setData(migrationData);
      }
    } catch (e) {
      console.log('Migration Preview - Error Fetching Data');
    }
  }

  return (
    <Container maxWidth="lg">
      <Stack spacing={2}>
        <PageHeader
          title="Migration Preview"
          description="Preview an account's assets after migration"
        />
        <Card sx={{ p: 2 }}>
          <Stack gap={1.5}>
            <Row
              justifyContent="center"
              alignItems="center"
              gap={2}
              sx={{ px: 0.5 }}
            >
              <Typography fontSize={20}>Enter Address</Typography>
              <TextField
                sx={{ width: 540 }}
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
                sx={{ maxWidth: 300 }}
                onClick={() => getMigrationData()}
              >
                Submit
              </Button>
              <Button
                size="large"
                fullWidth
                disabled={!connectedAccount}
                sx={{ maxWidth: 300 }}
                onClick={() => useConnectedWallet()}
              >
                Use Connected Wallet
              </Button>
            </Row>
          </Stack>
        </Card>
        {data && (
          <>
            <Card sx={{ p: 2 }}>
              <Typography variant="h2">Silo</Typography>
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
                    <Typography fontSize={18}>Earned Beans</Typography>
                    <Typography fontSize={20} variant="h4">
                      {TokenValue.fromBlockchain(
                        data.silo.earnedBeans,
                        BEAN.decimals
                      ).toHuman('short')}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography fontSize={18}>Current Stalk</Typography>
                    <Typography fontSize={20} variant="h4">
                      {TokenValue.fromBlockchain(
                        data.silo.currentStalk,
                        16
                      ).toHuman('short')}
                    </Typography>
                  </Box>
                  <ArrowForwardIcon sx={{ marginTop: 0.75 }} />
                  <Box>
                    <Typography fontSize={18}>Stalk After Mow</Typography>
                    <Typography fontSize={20} variant="h4" color={'primary'}>
                      {TokenValue.fromBlockchain(
                        data.silo.stalkAfterMow,
                        16
                      ).toHuman('short')}
                    </Typography>
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
                              <TableCell align="right">Recorded BDV</TableCell>
                              <TableCell align="right">Current Stalk</TableCell>
                              <TableCell align="right">
                                Stalk After Mow
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {data.silo.deposits.map(
                              (deposit: any, i: number) => {
                                const _currStalk = TokenValue.fromBlockchain(
                                  deposit.currentStalk,
                                  16
                                );
                                const _stalkAfterMow =
                                  TokenValue.fromBlockchain(
                                    deposit.stalkAfterMow,
                                    16
                                  );
                                const stalkIncrease =
                                  _stalkAfterMow.gt(_currStalk);
                                const token = Array.from(
                                  sdk.tokens.getMap(),
                                  ([key, value]) => value
                                ).find(
                                  (token) =>
                                    token.displayName.toLowerCase() ===
                                    deposit.token.toLowerCase()
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
                                    <TableCell component="th" scope="row">
                                      {deposit.token}
                                    </TableCell>
                                    <TableCell align="right">
                                      {TokenValue.fromBlockchain(
                                        deposit.amount,
                                        token?.decimals || 6
                                      ).toHuman('short')}
                                    </TableCell>
                                    <TableCell align="right">
                                      {TokenValue.fromBlockchain(
                                        deposit.recordedBdv,
                                        token?.decimals || 6
                                      ).toHuman('short')}
                                    </TableCell>
                                    <TableCell align="right">
                                      {_currStalk.toHuman('short')}
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography
                                        color={
                                          stalkIncrease ? 'primary' : undefined
                                        }
                                      >
                                        {_stalkAfterMow.toHuman('short')}
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
            </Card>
            <Card sx={{ p: 2 }}>
              <Typography variant="h2">Field</Typography>
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
                      {TokenValue.fromBlockchain(
                        data.field.totalPods,
                        BEAN.decimals
                      ).toHuman('short')}
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
                              <TableCell>Index</TableCell>
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
                                  {TokenValue.fromBlockchain(
                                    plot.index,
                                    6
                                  ).toHuman('short')}
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
            </Card>
            <Card sx={{ p: 2 }}>
              <Typography variant="h2">Barn</Typography>
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
                      {TokenValue.fromBlockchain(
                        data.barn.totalFert,
                        0
                      ).toHuman()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography fontSize={18}>Rinsable Sprouts</Typography>
                    <Typography fontSize={20} variant="h4">
                      {TokenValue.fromBlockchain(
                        data.barn.totalRinsable,
                        BEAN.decimals
                      ).toHuman('short')}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography fontSize={18}>Unrinsable Sprouts</Typography>
                    <Typography fontSize={20} variant="h4">
                      {TokenValue.fromBlockchain(
                        data.barn.totalUnrinsable,
                        BEAN.decimals
                      ).toHuman('short')}
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
            </Card>
            <Card sx={{ p: 2 }}>
              <Typography variant="h2">Farm</Typography>
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
                        {data.farm.map((token: any, i: number) => {
                          const _token = Array.from(
                            sdk.tokens.getMap(),
                            ([key, value]) => value
                          ).find(
                            (tokenData) =>
                              tokenData.displayName.toLowerCase() ===
                              token.token.toLowerCase()
                          );

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
                              <TableCell component="th" scope="row">
                                {token.token}
                              </TableCell>
                              <TableCell align="right">
                                {TokenValue.fromBlockchain(
                                  token.currentInternal,
                                  _token?.decimals || 6
                                ).toHuman('short')}
                              </TableCell>
                              <TableCell align="right">
                                {TokenValue.fromBlockchain(
                                  token.withdrawn,
                                  _token?.decimals || 6
                                ).toHuman('short')}
                              </TableCell>
                              <TableCell align="right">
                                {TokenValue.fromBlockchain(
                                  token.unpicked,
                                  _token?.decimals || 6
                                ).toHuman('short')}
                              </TableCell>
                              <TableCell align="right">
                                {TokenValue.fromBlockchain(
                                  token.rinsable,
                                  _token?.decimals || 6
                                ).toHuman('short')}
                              </TableCell>
                              <TableCell align="right">
                                {TokenValue.fromBlockchain(
                                  token.total,
                                  _token?.decimals || 6
                                ).toHuman('short')}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Box>This Farm is empty.</Box>
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
