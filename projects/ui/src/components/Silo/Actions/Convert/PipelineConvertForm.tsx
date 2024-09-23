import React, { useEffect, useCallback, useMemo, useState } from 'react';
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
} from '~/components/Common/Form';
import Row from '~/components/Common/Row';
import PillRow from '~/components/Common/Form/PillRow';
import TokenIcon from '~/components/Common/TokenIcon';
import WarningAlert from '~/components/Common/Alert/WarningAlert';
import TxnAccordion from '~/components/Common/TxnAccordion';
import StatHorizontal from '~/components/Common/StatHorizontal';

import { ActionType, displayFullBN, transform } from '~/util';
import { useAppSelector } from '~/state';
import { BaseConvertFormProps } from './types';

interface Props extends BaseConvertFormProps {
  farmerBalances: TokenSiloBalance | undefined;
}

interface PipelineConvertFormProps extends Props {
  sourceWell: BasinWell;
  targetWell: BasinWell;
}

interface PipeConvertResult {
  toAmount: ethers.BigNumber;
  fromBdv: ethers.BigNumber;
  toBdv: ethers.BigNumber;
  toStem: ethers.BigNumber;
}

const baseQueryOptions = {
  staleTime: 20_000, // 20 seconds stale time
  refetchOnWindowFocus: false,
  refetchIntervalInBackground: false,
} as const;

const PipelineConvertFormInner = ({
  sourceWell,
  targetWell,
  tokenList,
  siloBalances,
  farmerBalances: balance, // sdk type
  // handleQuote,
  sdk,
  // Formik
  values,
  isSubmitting,
  setFieldValue,
}: PipelineConvertFormProps) => {
  const beanstalkSiloBalances = useAppSelector(
    (s) => s._beanstalk.silo.balances
  );

  const [tokenSelectOpen, showTokenSelect, hideTokenSelect] = useToggle();
  const [convertResults, setConvertResults] = useState<
    PipeConvertResult | undefined
  >(undefined);

  const getBDV = useBDV();

  const sourceToken = sourceWell.lpToken; // LP token of source well
  const targetToken = targetWell.lpToken; // LP token of target well
  const slippage = values.settings.slippage;

  const sourceTokenStemTip =
    beanstalkSiloBalances[sourceToken.address]?.stemTip;
  const targetTokenStemTip =
    beanstalkSiloBalances[targetToken.address]?.stemTip;

  const debouncedAmountIn = useDebounce(values.tokens[0].amount ?? ZERO_BN); //

  const maxConvertableBN = useMemo(
    () =>
      new BigNumber((balance?.convertibleAmount || TokenValue.ZERO).toHuman()),
    [balance?.convertibleAmount]
  );

  const pickedDeposits = sdk.silo.siloConvert.calculateConvert(
    sourceToken,
    targetToken,
    sourceToken.fromHuman(debouncedAmountIn.toString()),
    balance?.convertibleDeposits || [],
    0
  );

  // same as query.isFetching & query.isLoading
  const isQuoting = values.tokens?.[0]?.quoting;

  // prettier-ignore
  const { data, ...query } = useQuery({
    queryKey: [
      'pipelineConvert', 
      sourceWell.address, 
      targetWell.address, 
      debouncedAmountIn.toString(),
      pickedDeposits.crates,
      slippage,
    ],
    queryFn: async () => {
      console.log({
        sourceToken,
        targetToken,
        debouncedAmountIn,
        maxConvertableBN,
        pickedDeposits,
      });

      try {
        setFieldValue('tokens.0.quoting', true);
        console.log("debouncedAmountIn: ", debouncedAmountIn.toString());
        const { 
          amountOut,
          advPipeCalls
        } = await sdk.silo.pipelineConvert.removeEqual2AddEqualQuote(
          sourceWell,
          targetWell,
          sourceWell.lpToken.fromHuman(debouncedAmountIn.toString()),
          slippage / 100 // 0x uses a different slippage format
        );

        setFieldValue('pipe.structs', advPipeCalls);

        return {
          amountOut,
          advPipeCalls
        };
      } catch (e) {
        console.debug('[pipelineConvert/query] FAILED: ', e);
        setFieldValue('tokens.0.quoting', false);
        throw e;
      }
    },
    enabled: maxConvertableBN.gt(0) && debouncedAmountIn?.gt(0) && pickedDeposits.crates.length > 0,
    ...baseQueryOptions,
  });

  const handleQuoteResult = useCallback(async () => {
    if (
      !data ||
      data.amountOut.lte(0) ||
      !data.advPipeCalls.length ||
      query.isLoading ||
      query.isFetching
    ) {
      return;
    }
    try {
      const result = await sdk.contracts.beanstalk.callStatic.pipelineConvert(
        sourceToken.address,
        pickedDeposits.crates.map((c) => c.stem),
        pickedDeposits.crates.map((c) => c.amount.toBigNumber()),
        targetToken.address,
        data.advPipeCalls
      );
      const toAmount = transform(result.toAmount, 'bnjs', targetToken);
      setFieldValue('pipe.amountOut', toAmount);

      setConvertResults({
        toAmount: result.toAmount,
        fromBdv: result.fromBdv,
        toBdv: result.toBdv,
        toStem: result.toStem,
      });
    } catch (e) {
      console.error('[pipelineConvert/handleQuoteResult] FAILED: ', e);
      throw e;
    } finally {
      setFieldValue('tokens.0.quoting', false);
    }
  }, [
    sdk.contracts.beanstalk,
    query.isFetching,
    query.isLoading,
    data,
    pickedDeposits.crates,
    targetToken,
    sourceToken,
    setFieldValue,
  ]);

  useEffect(() => {
    handleQuoteResult();
  }, [handleQuoteResult]);

  /// When a new output token is selected, reset maxAmountIn.
  const handleSelectTokenOut = async (_selectedTokens: Set<Token>) => {
    const selected = [..._selectedTokens]?.[0];

    if (!selected || _selectedTokens.size !== 1) {
      throw new Error();
    }

    /// only reset if the user clicked a different token
    if (targetToken !== selected) {
      setFieldValue('tokenOut', selected);
      setFieldValue('maxAmountIn', null);
    }
  };

  const deltaStemTip =
    convertResults &&
    targetTokenStemTip &&
    convertResults.toStem.sub(targetTokenStemTip);

  const grownStalk =
    convertResults &&
    deltaStemTip &&
    sdk.tokens.STALK.fromBlockchain(
      deltaStemTip.mul(convertResults.toBdv.toString())
    );

  const baseStalk =
    convertResults &&
    sdk.tokens.STALK.fromHuman(convertResults.toBdv.toString());

  const totalStalk = baseStalk && grownStalk && baseStalk.add(grownStalk);

  const getButtonContents = () => {
    if (maxConvertableBN.eq(0)) {
      return 'Nothing to Convert';
    }
    return 'Convert';
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
                  onClick={showTokenSelect}
                  buttonLabel={sourceToken.symbol}
                  disabled={isSubmitting}
                />
              ),
            }}
            balance={maxConvertableBN}
            quote={
              <Row gap={0.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
                <Tooltip
                  title={
                    <Stack gap={0.5}>
                      <StatHorizontal label="Current BDV:">
                        ~ x instant BDV
                        {/* ~{displayFullBN(instantBDV, 2, 2)} */}
                      </StatHorizontal>
                      <StatHorizontal label="Recorded BDV:">
                        ~ x deposited BDV
                        {/* ~{displayFullBN(depositBDV, 2, 2)} */}
                      </StatHorizontal>
                    </Stack>
                  }
                  placement="top"
                >
                  <Box display="flex" text-align="center" gap={0.25}>
                    <Typography variant="body1">
                      {/* ~{displayFullBN(depositsBDV, 2)} BDV */}x BDV
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
                {/* {displayQuote(state.amountOut, tokenOut)} */}
                {isQuoting && (
                  <CircularProgress
                    variant="indeterminate"
                    size="small"
                    sx={{ width: 14, height: 14 }}
                  />
                )}
              </Row>
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
          <Stack>
            <Stack gap={0.5}>
              {data && (
                <>
                  <Typography>values from pipe convert:</Typography>
                  <Typography>
                    Amount Out: {data?.amountOut.toString()}
                  </Typography>
                </>
              )}
            </Stack>

            {convertResults && (
              <>
                <Typography>base Stalk: {baseStalk?.toHuman()}</Typography>
                <Typography>grown Stalk: {grownStalk?.toHuman()}</Typography>
                <Typography>Total Stalk: {totalStalk?.toHuman()}</Typography>
              </>
            )}
          </Stack>
          {/* You may Lose Grown Stalk warning here */}
          <Box>
            <WarningAlert iconSx={{ alignItems: 'flex-start' }}>
              You may lose Grown Stalk through this transaction.
            </WarningAlert>
          </Box>
          {debouncedAmountIn?.gt(0) && data?.amountOut?.gt(0) && (
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
                        data?.amountOut || ZERO_BN,
                        targetToken.displayDecimals
                      )} ${targetToken.name}.`,
                    },
                    {
                      type: ActionType.UPDATE_SILO_REWARDS,
                      stalk: ZERO_BN,
                      seeds: ZERO_BN,
                    },
                  ]}
                />
              </TxnAccordion>
            </Box>
          )}
          <SmartSubmitButton
            loading={isQuoting || isSubmitting}
            disabled={isSubmitting}
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
