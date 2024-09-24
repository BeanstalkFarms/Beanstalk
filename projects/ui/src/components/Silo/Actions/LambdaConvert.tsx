import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import TokenIcon from '~/components/Common/TokenIcon';
import useSdk from '~/hooks/sdk';
import { InfoOutlined } from '@mui/icons-material';
import Row from '~/components/Common/Row';
import stalkIconGrey from '~/img/beanstalk/stalk-icon-grey.svg';
import seedIconGrey from '~/img/beanstalk/seed-icon-grey.svg';
import { ActionType, displayFullBN, formatTV } from '~/util';
import { BeanstalkSDK, ERC20Token, TokenValue } from '@beanstalk/sdk';
import { BeanstalkPalette } from '~/components/App/muiTheme';

import { LongArrowRight } from '~/components/Common/SystemIcons';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import TransactionToast from '~/components/Common/TxnToast';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import { useAppSelector } from '~/state';
import { ZERO_BN } from '~/constants';
import { useBeanstalkTokens } from '~/hooks/beanstalk/useTokens';
import { TxnPreview } from '~/components/Common/Form';
import TxnAccordion from '~/components/Common/TxnAccordion';
import {
  UpdatableDepositsByToken,
  useTokenDepositsContext,
} from '../Token/TokenDepositsContext';

const LambdaConvert = ({
  token,
  updatableDeposits,
}: {
  token: ERC20Token;
  updatableDeposits: UpdatableDepositsByToken;
}) => {
  const { selected, clear } = useTokenDepositsContext();
  const { STALK, SEEDS } = useBeanstalkTokens();
  const sdk = useSdk();

  const [combine, setCombine] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fetchFarmerSilo] = useFetchFarmerSilo();
  const [deltaStalk, setDeltaStalk] = useState(STALK.fromHuman('0'));
  const [deltaSeed, setDeltaSeed] = useState(SEEDS.fromHuman('0'));
  const [deltaOwnership, setDeltaOwnership] = useState(ZERO_BN);
  const [deltaStalkPerSeason, setDeltaStalkPerSeason] = useState(
    STALK.fromHuman('0')
  );

  const balanceOfStalk = useAppSelector((s) => s._farmer.silo.stalk.active);
  const balanceOfSeed = useAppSelector((s) => s._farmer.silo.seeds.active);
  const beanstalkTotalStalk = useAppSelector(
    (s) => s._beanstalk.silo.stalk.active
  );

  useEffect(() => {
    let _deltaStalk: TokenValue = STALK.fromHuman('0');
    let _deltaSeed: TokenValue = SEEDS.fromHuman('0');

    selected.forEach((key) => {
      const deposit = updatableDeposits[key];
      _deltaStalk = _deltaStalk.add(deposit.deltaStalk);
      _deltaSeed = _deltaSeed.add(deposit.deltaSeed);
    });

    const recordedStalkPct = beanstalkTotalStalk.gt(0)
      ? balanceOfStalk.div(beanstalkTotalStalk).times(100)
      : ZERO_BN;

    const updatedStalkBal = balanceOfStalk.plus(_deltaStalk.toNumber());
    const updatedStalkPct = beanstalkTotalStalk.gt(0)
      ? updatedStalkBal.div(beanstalkTotalStalk).times(100)
      : ZERO_BN;

    const deltaStalkPct = updatedStalkPct.minus(recordedStalkPct);

    setDeltaStalk(_deltaStalk);
    setDeltaSeed(_deltaSeed);
    setDeltaOwnership(deltaStalkPct);
    setDeltaStalkPerSeason(STALK.fromHuman(_deltaSeed.toNumber()));
  }, [
    selected,
    updatableDeposits,
    balanceOfSeed,
    beanstalkTotalStalk,
    balanceOfStalk,
    SEEDS,
    STALK,
  ]);

  useEffect(() => {
    if (selected.size <= 1 && combine) {
      setCombine(false);
    }
  }, [selected, combine]);

  const onSubmit = async () => {
    if (!selected.size) {
      throw new Error('No deposits selected');
    }

    const txToast = new TransactionToast({
      success: `Successfully updated ${selected.size} ${token.symbol} deposit${selected.size === 1 ? '' : 's'}`,
      loading: 'Updating your deposits...',
    });
    try {
      setSubmitting(true);
      const farm = constructLambdaConvert(
        sdk,
        selected,
        updatableDeposits,
        token,
        combine
      );

      await farm.estimate(ethers.constants.Zero);
      const tx = await farm.execute(ethers.constants.Zero, { slippage: 0.1 });

      txToast.confirming(tx);

      const receipt = await tx.wait();
      await fetchFarmerSilo();

      txToast.success(receipt);

      clear();
    } catch (e) {
      console.error(e);
      txToast.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack gap={1}>
      <Box px={1}>
        <Typography variant="subtitle1">
          {selected.size} Deposit{selected.size === 1 ? '' : 's'} selected
        </Typography>
      </Box>
      <Card sx={{ background: 'white', borderColor: 'white', p: 2 }}>
        <Stack gap={1.5}>
          <Stack direction="row" justifyContent="space-between" gap={1}>
            <Stack>
              <Row gap={0.5}>
                <TokenIcon
                  token={sdk.tokens.STALK}
                  logoOverride={stalkIconGrey}
                  css={{ width: '20px', height: '20px' }}
                />
                <Typography variant="subtitle1" color="text.secondary">
                  {sdk.tokens.STALK.symbol}
                </Typography>
              </Row>
              <Typography
                variant="bodySmall"
                color="text.secondary"
                sx={{ pl: 2.5 }}
              >
                Ownership of Beanstalk{' '}
                <Tooltip title="Ownership of Beanstalk">
                  <InfoOutlined
                    sx={{
                      display: 'inline',
                      mb: 0.3,
                      height: '12px',
                      width: '12px',
                      color: 'text.secondary',
                    }}
                  />
                </Tooltip>
              </Typography>
            </Stack>
            <Stack>
              <Typography variant="subtitle1" color="primary" align="right">
                + {formatTV(deltaStalk, 2)}
              </Typography>
              <Typography
                variant="bodySmall"
                color="text.tertiary"
                align="right"
              >
                +{' '}
                {deltaOwnership.lte(0)
                  ? '0.00'
                  : deltaOwnership.gte(0.0001)
                    ? displayFullBN(deltaOwnership, 4)
                    : '<0.0001'}
                %
              </Typography>
            </Stack>
          </Stack>
          <Stack direction="row" justifyContent="space-between" gap={1}>
            <Stack>
              <Row gap={0.5}>
                <TokenIcon
                  token={sdk.tokens.SEEDS}
                  logoOverride={seedIconGrey}
                  css={{ width: '20px', height: '20px' }}
                />
                <Typography variant="subtitle1" color="text.secondary">
                  {sdk.tokens.SEEDS.symbol}
                </Typography>
              </Row>
              <Typography
                variant="bodySmall"
                color="text.secondary"
                sx={{ pl: 2.5 }}
              >
                Stalk Growth per Season{' '}
                <Tooltip title="Stalk grown per season">
                  <InfoOutlined
                    sx={{
                      display: 'inline',
                      mb: 0.3,
                      height: '12px',
                      width: '12px',
                      color: 'text.secondary',
                    }}
                  />
                </Tooltip>
              </Typography>
            </Stack>
            <Stack>
              <Typography variant="subtitle1" color="primary" align="right">
                + {formatTV(deltaSeed, 2)}
              </Typography>
              <Typography
                variant="bodySmall"
                color="text.tertiary"
                align="right"
              >
                + {formatTV(deltaStalkPerSeason, 6)}
              </Typography>
            </Stack>
          </Stack>
        </Stack>
      </Card>
      {!!selected.size && (
        <>
          <Stack gap={1}>
            {combine && (
              <Card sx={{ p: 2, background: 'white', borderColor: 'white' }}>
                <Row justifyContent="space-between">
                  <Typography color="text.secondary">
                    {selected.size} {token.symbol} Deposits
                  </Typography>
                  <LongArrowRight color="black" />
                  <Typography color="text.secondary">
                    1 {token.symbol} Deposit
                  </Typography>
                </Row>
              </Card>
            )}
            <Card
              sx={{
                px: 2,
                py: 1.5,
                borderColor: combine
                  ? BeanstalkPalette.logoGreen
                  : BeanstalkPalette.lightestGrey,
                background: combine ? BeanstalkPalette.lightestGreen : 'white',
              }}
            >
              <Row justifyContent="space-between">
                <Typography color={combine ? 'primary' : 'text.secondary'}>
                  Combine Deposits of the same asset into one Deposit
                </Typography>
                <Switch
                  value={combine}
                  onChange={() => setCombine((prev) => !prev)}
                />
              </Row>
            </Card>
          </Stack>
          <Box>
            <TxnAccordion defaultExpanded={false}>
              <TxnPreview
                actions={[
                  {
                    type: ActionType.BASE,
                    message: `Update ${selected.size} ${token.symbol} deposit${
                      selected.size === 1 ? '' : 's'
                    }`,
                  },
                  {
                    type: ActionType.UPDATE_SILO_REWARDS,
                    stalk: new BigNumber(deltaStalk.toHuman()) || ZERO_BN,
                    seeds: new BigNumber(deltaSeed.toHuman()) || ZERO_BN,
                  },
                ]}
              />
            </TxnAccordion>
          </Box>
        </>
      )}
      <Button
        size="large"
        disabled={!selected.size || submitting}
        onClick={onSubmit}
      >
        {selected.size ? 'Update Deposits' : 'Select Deposits'}
      </Button>
    </Stack>
  );
};

export default LambdaConvert;

function constructCombineDepositsCallStruct(
  sdk: BeanstalkSDK,
  selected: Set<string>,
  updatableDepositsById: UpdatableDepositsByToken,
  token: ERC20Token
) {
  let amountIn = token.fromHuman('0');
  const stems: ethers.BigNumber[] = [];
  const amounts: ethers.BigNumber[] = [];

  selected.forEach((id) => {
    const deposit = updatableDepositsById[id];
    amountIn = amountIn.add(deposit.amount);
    stems.push(deposit.stem);
    amounts.push(deposit.amount.toBigNumber());
  });

  const encoding = sdk.silo.siloConvert.calculateEncoding(
    token,
    token,
    amountIn,
    amountIn
  );

  const farmCallStruct = {
    target: sdk.contracts.beanstalk.address,
    callData: sdk.contracts.beanstalk.interface.encodeFunctionData('convert', [
      encoding,
      stems,
      amounts,
    ]),
  };

  return farmCallStruct;
}

function constructSingleDepositCallStruct(
  sdk: BeanstalkSDK,
  deposit: UpdatableDepositsByToken[string],
  token: ERC20Token
) {
  const encoding = sdk.silo.siloConvert.calculateEncoding(
    token,
    token,
    deposit.amount,
    deposit.amount
  );

  return {
    target: sdk.contracts.beanstalk.address,
    callData: sdk.contracts.beanstalk.interface.encodeFunctionData('convert', [
      encoding,
      [deposit.stem],
      [deposit.amount.toBigNumber()],
    ]),
  };
}

function constructLambdaConvert(
  sdk: BeanstalkSDK,
  selected: Set<string>,
  updateableDepositsById: UpdatableDepositsByToken,
  token: ERC20Token,
  combineDeposits: boolean
) {
  const farm = sdk.farm.create('lambda-2-lambda');

  const combining = selected.size > 1 && combineDeposits;

  if (combining) {
    const callStruct = constructCombineDepositsCallStruct(
      sdk,
      selected,
      updateableDepositsById,
      token
    );
    farm.add(() => callStruct);
  } else {
    selected.forEach((id) => {
      const deposit = updateableDepositsById[id];
      const callStruct = constructSingleDepositCallStruct(sdk, deposit, token);
      farm.add(() => callStruct);
    });
  }

  return farm;
}
