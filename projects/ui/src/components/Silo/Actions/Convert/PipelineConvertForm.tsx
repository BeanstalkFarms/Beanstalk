/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { Form } from 'formik';
import BigNumber from 'bignumber.js';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  CircularProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

import { BasinWell, Token, TokenSiloBalance, TokenValue } from '@beanstalk/sdk';

import { ZERO_BN } from '~/constants';
import useDebounce from '~/hooks/app/useDebounce';
import useBDV from '~/hooks/beanstalk/useBDV';
import useToggle from '~/hooks/display/useToggle';
import TokenSelectDialog, {
  TokenSelectMode,
} from '~/components/Common/Form/TokenSelectDialogNew';
import {
  SmartSubmitButton,
  TokenAdornment,
  TokenInputField,
  TxnPreview,
  TxnSeparator,
} from '~/components/Common/Form';
import Row from '~/components/Common/Row';
import PillRow from '~/components/Common/Form/PillRow';
import TokenIcon from '~/components/Common/TokenIcon';
import WarningAlert from '~/components/Common/Alert/WarningAlert';
import TxnAccordion from '~/components/Common/TxnAccordion';
import StatHorizontal from '~/components/Common/StatHorizontal';

import { ActionType, displayFullBN, transform } from '~/util';
import { useAppSelector } from '~/state';
import useQuoteAgnostic from '~/hooks/ledger/useQuoteAgnostic';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import useStemTipForToken from '~/hooks/beanstalk/useStemTipForToken';
import useSdk from '~/hooks/sdk';
import { PipelineConvert } from '~/lib/Beanstalk/PipelineConvert/PipelineConvert';
import { BaseConvertFormProps } from './types';

interface Props extends BaseConvertFormProps {
  farmerBalances: TokenSiloBalance | undefined;
}

interface PipelineConvertFormProps extends Props {
  sourceWell: BasinWell;
  targetWell: BasinWell;
}

const usePipelineConvert = () => {
  const sdk = useSdk();

  return useMemo(() => new PipelineConvert(sdk), [sdk]);
};

const PipelineConvertFormInner = ({
  sourceWell,
  targetWell,
  tokenList,
  farmerBalances: balance, // sdk type
  sdk,
  // Formik
  values,
  isSubmitting,
  setFieldValue,
}: PipelineConvertFormProps) => {
  // hooks + selectors
  const silo = useAppSelector((s) => s._beanstalk.silo);
  const farmerSilo = useAppSelector((s) => s._farmer.silo);
  const targetStemTip = useStemTipForToken(targetWell.lpToken);

  // Helpers
  const pipeConvert = usePipelineConvert();
  const getBDV = useBDV();

  const [tokenSelectOpen, showTokenSelect, hideTokenSelect] = useToggle();

  //
  const { STALK, SEEDS } = sdk.tokens;
  const sourceToken = sourceWell.lpToken; // LP token of source well
  const targetToken = targetWell.lpToken; // LP token of target well
  const slippage = values.settings.slippage;

  const convertibleDeposits = balance?.convertibleDeposits;

  const debouncedAmountIn = useDebounce(
    values.tokens[0].amount ?? ZERO_BN,
    500
  );

  const maxConvertableBN = useMemo(() => {
    const val = balance?.convertibleAmount || TokenValue.ZERO;
    return new BigNumber(val.toHuman());
  }, [balance?.convertibleAmount]);

  const pickedDeposits = useMemo(() => {
    const convert = sdk.silo.siloConvert;

    const siloConvert = convert.calculateConvert(
      sourceWell.lpToken,
      targetWell.lpToken,
      sourceWell.lpToken.fromHuman(debouncedAmountIn.toString()),
      convertibleDeposits || [],
      0
    );

    return siloConvert;
  }, [sdk, convertibleDeposits, debouncedAmountIn, sourceWell, targetWell]);

  const depositIds = pickedDeposits.crates.map((crate) =>
    crate.id.toHexString()
  );

  // QUERIES
  // prettier-ignore
  const { data, isFetching, isLoading, error: queryError } = useQuery({
    queryKey: ['pipelineConvert', sourceWell.address, targetWell.address, debouncedAmountIn.toString(), depositIds, slippage],
    queryFn: async () => {
      // setFieldValue('tokens.0.quoting', true);
      if (!balance || !pickedDeposits?.crates?.length) return;
      const response = await pipeConvert.fetchEq2Eq(
        sourceWell,
        targetWell,
        pickedDeposits.crates,
        sourceWell.lpToken.fromHuman(debouncedAmountIn.toString()),
        slippage / 100,
        slippage
      );
      return response;
    },
    enabled: maxConvertableBN.gt(0) && debouncedAmountIn?.gt(0),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: 20_000, // 20 seconds stale time
  });

  const handleQuoteResult = useCallback(async () => {
    // prettier-ignore
    if (!data || data.amountOut.lte(0) || !data.results.length || isLoading || isFetching || !!queryError) {
      return null;
    }

    const farm = sdk.farm.create();
    const beanstalk = sdk.contracts.beanstalk;
    const callDatas: string[] = [];

    try {
      console.debug('[pipelineConvertForm/handleQuoteResult] quoting...');

      data.results.forEach(({ deposit, advPipeCalls }) => {
        const callData = beanstalk.interface.encodeFunctionData(
          'pipelineConvert',
          [
            sourceToken.address,
            [deposit.stem],
            [deposit.amount.toBigNumber()],
            targetToken.address,
            advPipeCalls,
          ]
        );

        callDatas.push(callData);
        farm.add(() => ({
          target: beanstalk.address,
          callData,
        }));
      });

      // we can input zero here b/c the amounts are already contained w/in the individual calls.
      const result = await farm.callStatic(ethers.constants.Zero, { slippage });
      const decoded = PipelineConvert.decodeStaticResults(result);

      setFieldValue('pipe.amountOut', new BigNumber(data.amountOut.toHuman()));
      setFieldValue('pipe.callData', callDatas);
      return decoded;
    } catch (e) {
      console.error('[pipelineConvert/handleQuoteResult] FAILED: ', e);
      setFieldValue('pipe.callData', []);
      return null;
    } finally {
      setFieldValue('tokens.0.quoting', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk, data, slippage, isFetching, isLoading, queryError]);

  const [convertQuote, quoting, refetchQuote] = useQuoteAgnostic(
    handleQuoteResult,
    { debounceMs: 50 }
  );

  // EFFECTS
  useEffect(() => {
    refetchQuote();
  }, [refetchQuote]);

  const getConvertResults = useCallback(() => {
    if (
      debouncedAmountIn.eq(0) ||
      !convertQuote?.length ||
      !targetStemTip?.gt(0) ||
      !pickedDeposits?.crates?.length
    ) {
      return;
    }

    const debugArr: any[] = [];

    let totalDeltaBaseStalk = STALK.fromHuman('0');
    let totalDeltaGrownStalk = STALK.fromHuman('0');
    let totalDeltaSeed = SEEDS.fromHuman('0');

    convertQuote.forEach((result, i) => {
      const deposit = pickedDeposits.crates[i];
      if (!deposit) return;
      const toBDV = sdk.tokens.BEAN.fromBlockchain(result.toBdv);
      const deltaStem = targetStemTip.sub(result.toStem);

      const baseStalkAfter = targetToken.getStalk(toBDV);
      const grownStalkAfter = STALK.fromBlockchain(deltaStem.mul(result.toBdv));

      const deltaBaseStalk = baseStalkAfter.sub(deposit.stalk.base);
      const deltaGrownStalk = grownStalkAfter.sub(deposit.stalk.grown);

      totalDeltaGrownStalk = totalDeltaGrownStalk.add(deltaGrownStalk);
      totalDeltaBaseStalk = totalDeltaBaseStalk.add(deltaBaseStalk);

      const afterSeeds = targetToken.getSeeds(toBDV);
      const deltaSeed = afterSeeds.sub(deposit.seeds);
      totalDeltaSeed = totalDeltaSeed.add(deltaSeed);

      debugArr.push({
        depositId: deposit.id.toHexString(),
        amount: deposit.amount.blockchainString,
        toTokenStem: targetStemTip.toString(),
        result: {
          fromAmount: result.fromAmount.toString(),
          toAmount: result.toAmount.toString(),
          fromBdv: result.fromBdv.toString(),
          toBDV: result.toBdv.toString(),
          toStem: result.toStem.toString(),
        },
        before: {
          baseStalk: deposit.stalk.base.toHuman(),
          grownStalk: deposit.stalk.grown.toHuman(),
          totalStalk: deposit.stalk.total.toHuman(),
          seeds: deposit.seeds.toHuman(),
        },
        after: {
          baseStalk: baseStalkAfter.toHuman(),
          grownStalk: grownStalkAfter.toHuman(),
          totalStalk: baseStalkAfter.add(grownStalkAfter).toHuman(),
          seeds: afterSeeds.toHuman(),
        },
        delta: {
          stem: deltaStem.toString(),
          baseStalk: deltaBaseStalk.toHuman(),
          grownStalk: deltaGrownStalk.toHuman(),
          totalStalk: deltaBaseStalk.add(deltaGrownStalk).toHuman(),
          seeds: deltaSeed.toHuman(),
        },
      });
    });

    const beforeFarmerStalk = farmerSilo.stalk.active;
    const beanstalkTotalStalk = silo.stalk.active;

    const totalDeltaStalk = totalDeltaBaseStalk.add(totalDeltaGrownStalk);
    const afterFarmerStalk = beforeFarmerStalk.plus(totalDeltaStalk.toHuman());

    const currOwnershipRatio = beforeFarmerStalk.div(beanstalkTotalStalk);
    const newOwnershipRatio = afterFarmerStalk.div(beanstalkTotalStalk);
    const deltaOwnership = newOwnershipRatio
      .minus(currOwnershipRatio)
      .times(100);

    console.log('RESULTS INDIVIDUAL: ', debugArr);
    console.log('RESULTS TOTALS: ', {
      deltaGrownStalk: totalDeltaGrownStalk.toHuman(),
      deltaBaseStalk: totalDeltaBaseStalk.toHuman(),
      deltaStalk: totalDeltaStalk.toHuman(),
      deltaSeed: totalDeltaSeed.toHuman(),
    });

    return {
      deltaGrownStalk: transform(totalDeltaGrownStalk, 'bnjs', STALK),
      deltaBaseStalk: transform(totalDeltaBaseStalk, 'bnjs', STALK),
      deltaStalk: transform(totalDeltaStalk, 'bnjs', STALK),
      deltaSeed: transform(totalDeltaSeed, 'bnjs', SEEDS),
      deltaOwnership,
      deltaStalkPerSeason: ZERO_BN,
    };
  }, [
    debouncedAmountIn,
    convertQuote,
    targetStemTip,
    pickedDeposits.crates,
    STALK,
    SEEDS,
    farmerSilo.stalk.active,
    silo.stalk.active,
    sdk.tokens.BEAN,
    targetToken,
  ]);

  const convertResults = useMemo(
    () => getConvertResults(),
    [getConvertResults]
  );

  /// When a new output token is selected, reset maxAmountIn.
  const handleSelectTokenOut = async (_selectedTokens: Set<Token>) => {
    const selected = [..._selectedTokens]?.[0];
    if (!selected || _selectedTokens.size !== 1) throw new Error();
    /// only reset if the user clicked a different token
    if (!targetToken.equals(selected)) {
      setFieldValue('tokenOut', selected);
      setFieldValue('maxAmountIn', null);
    }
  };

  const isQuoting = isFetching || isLoading || quoting;
  const instantaneousBDVIn = getBDV(sourceToken).times(debouncedAmountIn);
  const depositsBDV = pickedDeposits.bdv;

  const isReady =
    convertResults &&
    data?.amountOut?.gt(0) &&
    !isQuoting &&
    !!values.pipe.callData.length;

  const getButtonContents = () => {
    if (maxConvertableBN.eq(0)) {
      return 'Nothing to Convert';
    }
    return 'Convert';
  };

  const getDeltaOwnershipDisplay = () => {
    if (!convertResults?.deltaOwnership) return '0.0000%';
    if (convertResults?.deltaOwnership.abs().lte(0.00001)) {
      const sign = convertResults?.deltaOwnership.isPositive() ? '+' : '-';
      return `> ${sign}0.00001%`;
    }
    return `~ ${displayFullBN(convertResults.deltaOwnership, 4)}%`;
  };

  return (
    <>
      <Form noValidate autoComplete="off">
        <TokenSelectDialog
          open={tokenSelectOpen}
          handleClose={hideTokenSelect}
          handleSubmit={handleSelectTokenOut}
          selected={values.tokens}
          tokenList={tokenList}
          mode={TokenSelectMode.SINGLE}
        />
        <Stack gap={1}>
          <TokenInputField
            name="tokens.0.amount"
            token={sourceToken}
            balanceLabel="Deposited Balance"
            // MUI
            fullWidth
            max={maxConvertableBN}
            InputProps={{
              endAdornment: (
                <TokenAdornment
                  token={sourceToken}
                  buttonLabel={sourceToken.symbol}
                  disabled={isSubmitting}
                />
              ),
            }}
            balance={maxConvertableBN}
            quote={
              <InputQuote
                isQuoting={isQuoting}
                instantaneousBDVIn={instantaneousBDVIn}
                depositsBDV={depositsBDV}
              />
            }
          />
          {maxConvertableBN.gt(0) ? (
            <PillRow
              isOpen={tokenSelectOpen}
              label="Convert to"
              onClick={showTokenSelect}
            >
              {targetToken ? <TokenIcon token={targetToken} /> : null}
              <Typography>{targetToken?.symbol || 'Select token'}</Typography>
            </PillRow>
          ) : null}
          {convertResults ? (
            <Stack>
              <TxnSeparator mt={-1} />
              <TokenOutput>
                <TokenOutput.Row
                  token={targetToken}
                  amount={values.pipe.amountOut || ZERO_BN}
                />
                <TokenOutput.MultiRow
                  token={STALK}
                  amount={convertResults.deltaStalk}
                  below={[
                    {
                      description: 'Base Stalk',
                      descriptionTooltip: 'The net change in Base Stalk',
                      delta: convertResults.deltaBaseStalk,
                    },
                    {
                      description: 'Grown Stalk',
                      descriptionTooltip: 'The net change in Grown stalk',
                      delta: convertResults.deltaGrownStalk,
                    },
                    {
                      description: 'Ownership of Beanstalk',
                      descriptionTooltip:
                        'This is the change in your ownership of Beanstalk through this transaction.',
                      delta: getDeltaOwnershipDisplay(),
                    },
                  ]}
                />
                <TokenOutput.Row
                  token={SEEDS}
                  amount={convertResults.deltaSeed}
                />
              </TokenOutput>
            </Stack>
          ) : null}
          {/* You may Lose Grown Stalk warning here */}
          <Box>
            <WarningAlert iconSx={{ alignItems: 'flex-start' }}>
              You may lose Grown Stalk through this transaction.
            </WarningAlert>
          </Box>
          {debouncedAmountIn?.gt(0) &&
            convertResults &&
            data?.amountOut?.gt(0) && (
              <Box>
                <TxnAccordion defaultExpanded={false}>
                  <TxnPreview
                    actions={[
                      {
                        type: ActionType.BASE,
                        message: `Convert ${displayFullBN(
                          debouncedAmountIn,
                          sourceToken.displayDecimals
                        )} ${sourceToken.name} to ${displayFullBN(
                          data.amountOut || ZERO_BN,
                          targetToken.displayDecimals
                        )} ${targetToken.name}.`,
                      },
                      {
                        type: ActionType.UPDATE_SILO_REWARDS,
                        stalk: convertResults.deltaStalk,
                        seeds: convertResults.deltaSeed,
                      },
                    ]}
                  />
                </TxnAccordion>
              </Box>
            )}
          <SmartSubmitButton
            loading={isQuoting || isSubmitting}
            disabled={isSubmitting || !isReady}
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            tokens={[]}
            mode="auto"
          >
            {getButtonContents()}
          </SmartSubmitButton>
        </Stack>
      </Form>
    </>
  );
};

const InputQuote = React.memo(
  (props: {
    isQuoting: boolean;
    instantaneousBDVIn: BigNumber;
    depositsBDV: TokenValue;
  }) => (
    <Row gap={0.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
      <Tooltip
        title={
          <Stack gap={0.5}>
            <StatHorizontal label="Current BDV:">
              ~{displayFullBN(props.instantaneousBDVIn, 2)}
            </StatHorizontal>
            <StatHorizontal label="Recorded BDV:">
              ~ {displayFullBN(props.depositsBDV, 2)}
            </StatHorizontal>
          </Stack>
        }
        placement="top"
      >
        <Box display="flex" text-align="center" gap={0.25}>
          <Typography variant="body1">
            ~{displayFullBN(props.depositsBDV, 2)} BDV
          </Typography>
          <HelpOutlineIcon
            sx={{
              color: 'text.secondary',
              display: 'inline-block',
              margin: 'auto',
              fontSize: '14px',
            }}
          />
        </Box>
      </Tooltip>
      {props.isQuoting && (
        <CircularProgress
          variant="indeterminate"
          size="small"
          sx={{ width: 14, height: 14 }}
        />
      )}
    </Row>
  )
);

export const PipelineConvertForm = ({ values, sdk, ...restProps }: Props) => {
  const sourceToken = values.tokens?.[0].token;
  const targetToken = values.tokenOut;

  // No need to memoize wells since they their object references don't change
  const sourceWell = sourceToken && sdk.pools.getWellByLPToken(sourceToken);
  const targetWell = targetToken && sdk.pools.getWellByLPToken(targetToken);

  if (!sourceWell || !targetWell) return null;

  return (
    <PipelineConvertFormInner
      values={values}
      sdk={sdk}
      sourceWell={sourceWell}
      targetWell={targetWell}
      {...restProps}
    />
  );
};
