import React, { useEffect } from 'react';

import { Form } from 'formik';
import BigNumber from 'bignumber.js';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
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

import { ActionType, displayFullBN } from '~/util';
import { useAccount } from 'wagmi';
import { BaseConvertFormProps } from './types';

interface Props extends BaseConvertFormProps {
  farmerBalances: TokenSiloBalance | undefined;
}

const defaultWellLpOut = [TokenValue.ZERO, TokenValue.ZERO];

const baseQueryOptions = {
  refetchOnWindowFocus: true,
  staleTime: 20_000, // 20 seconds stale time
  refetchIntervalInBackground: false,
};

// prettier-ignore
const queryKeys = {
  wellLPOut: (sourceWell: BasinWell,targetWell: BasinWell,amountIn: BigNumber) => [
    ['pipe-convert'], ['source-lp-out'], sourceWell?.address || 'no-source-well', targetWell?.address || 'no-target-well', amountIn.toString(),
  ],
  swapOut: (sellToken: Token, buyToken: Token, amountIn: TokenValue, slippage: number) => [
    ['pipe-convert'], ['swap-out'], sellToken?.address || 'no-sell-token', buyToken?.address || 'no-buy-token', amountIn.toHuman(), slippage,
  ],
  addLiquidity: (tokensIn: Token[], beanIn: TokenValue | undefined, nonBeanIn: TokenValue | undefined
  ) => [
    ['pipe-convert'],
    'add-liquidity',
    ...tokensIn.map((t) => t.address),
    beanIn?.blockchainString || '0',
    nonBeanIn?.blockchainString || '0',
  ],
};

interface PipelineConvertFormProps extends Props {
  sourceWell: BasinWell;
  targetWell: BasinWell;
}

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
  const [tokenSelectOpen, showTokenSelect, hideTokenSelect] = useToggle();
  const account = useAccount();
  const getBDV = useBDV();

  const sourceToken = sourceWell.lpToken; // LP token of source well
  const targetToken = targetWell.lpToken; // LP token of target well
  const BEAN = sdk.tokens.BEAN;

  // Form values
  const amountIn = values.tokens[0].amount; // amount of from token

  const maxConvertable = (
    balance?.convertibleAmount || TokenValue.ZERO
  ).toHuman();

  const maxConvertableBN = new BigNumber(maxConvertable);

  // const amountOut = values.tokens[0].amountOut; // amount of to token
  // const maxAmountIn = values.maxAmountIn;
  // const canConvert = maxAmountIn?.gt(0) || false;
  // const plantCrate = plantAndDoX?.crate?.bn;

  const debouncedAmountIn = useDebounce(amountIn ?? ZERO_BN);

  const sourceIndexes = getWellTokenIndexes(sourceWell, BEAN);
  const targetIndexes = getWellTokenIndexes(targetWell, BEAN);

  const sellToken = sourceWell.tokens[sourceIndexes.nonBeanIndex]; // token we will sell when after removing liquidity in equal parts
  const buyToken = targetWell.tokens[targetIndexes.nonBeanIndex]; // token we will buy to add liquidity

  const slippage = values.settings.slippage;

  const fetchEnabled = account.address && maxConvertableBN.gt(0);

  const { data: removeOut, ...removeOutQuery } = useQuery({
    queryKey: queryKeys.wellLPOut(sourceWell, targetWell, debouncedAmountIn),
    queryFn: async () => {
      const outAmount = await sourceWell.getRemoveLiquidityOutEqual(
        sourceWell.lpToken.fromHuman(debouncedAmountIn.toString())
      );

      console.log(`[pipelineConvert/removeOutQuery (1)]: amountOut: `, {
        BEAN: outAmount[sourceIndexes.beanIndex].toNumber(),
        [`${sellToken.symbol}`]:
          outAmount[sourceIndexes.nonBeanIndex].toNumber(),
      });
      return outAmount;
    },
    enabled: fetchEnabled && debouncedAmountIn?.gt(0) && amountIn?.gt(0),
    initialData: defaultWellLpOut,
    ...baseQueryOptions,
  });

  const beanAmountOut = removeOut[sourceIndexes.beanIndex];
  const swapAmountIn = removeOut[sourceIndexes.nonBeanIndex];

  // prettier-ignore
  const { data: swapQuote, ...swapOutQuery } = useQuery({
    queryKey: queryKeys.swapOut(sellToken, buyToken, swapAmountIn, slippage),
    queryFn: async () => {
      const quote = await sdk.zeroX.fetchSwapQuote({
        // 0x requests are formatted such that 0.01 = 1%. Everywhere else in the UI we use 0.01 = 0.01% ?? BS3TODO: VALIDATE ME
        slippagePercentage: (slippage / 10).toString(),
        sellToken: sellToken.address,
        buyToken: buyToken.address,
        sellAmount: swapAmountIn.blockchainString,
      });
      console.log(
        `[pipelineConvert/swapOutQuery (2)]: buyAmount: ${quote?.buyAmount}`
      );
      return quote;
    },
    retryDelay: 500, // We get 10 requests per second from 0x, so wait 500ms before trying again.
    enabled: fetchEnabled && swapAmountIn?.gt(0) && getNextChainedQueryEnabled(removeOutQuery),
    ...baseQueryOptions,
  });

  const buyAmount = buyToken.fromBlockchain(swapQuote?.buyAmount || '0');
  const addLiqTokens = targetWell.tokens;

  const { data: targetAmountOut, ...addLiquidityQuery } = useQuery({
    queryKey: queryKeys.addLiquidity(addLiqTokens, beanAmountOut, buyAmount),
    queryFn: async () => {
      const outAmount = await targetWell.getAddLiquidityOut([
        beanAmountOut,
        buyAmount,
      ]);

      setFieldValue('tokens.0.amountOut', new BigNumber(outAmount.toHuman()));
      console.log(
        `[pipelineConvert/addLiquidityQuery (3)]: amountOut: ${outAmount.toNumber()}`
      );
      return outAmount;
    },
    enabled:
      fetchEnabled &&
      buyAmount.gt(0) &&
      getNextChainedQueryEnabled(swapOutQuery),
    ...baseQueryOptions,
  });

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

  // prettier-ignore
  const isLoading = removeOutQuery.isLoading || swapOutQuery.isLoading || addLiquidityQuery.isLoading;
  useEffect(() => {
    setFieldValue('tokens.0.quoting', isLoading);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

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
            balanceLabel="Deposited Balance"
            // MUI
            fullWidth
            max={new BigNumber(maxConvertable)}
            InputProps={{
              endAdornment: (
                <TokenAdornment
                  token={targetToken}
                  onClick={showTokenSelect}
                  buttonLabel={targetToken.symbol}
                  disabled={isSubmitting}
                />
              ),
            }}
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
                {isLoading && (
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
          {/* You may Lose Grown Stalk warning here */}
          <Box>
            <WarningAlert iconSx={{ alignItems: 'flex-start' }}>
              You may lose Grown Stalk through this transaction.
            </WarningAlert>
          </Box>
          {amountIn?.gt(0) && targetAmountOut?.gt(0) && (
            <Box>
              <TxnAccordion defaultExpanded={false}>
                <TxnPreview
                  actions={[
                    {
                      type: ActionType.BASE,
                      message: `Convert ${displayFullBN(
                        amountIn,
                        sourceToken.displayDecimals
                      )} ${sourceToken.name} to ${displayFullBN(
                        targetAmountOut || ZERO_BN,
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
        </Stack>
      </Form>
    </>
  );
};

export const PipelineConvertForm = ({ values, sdk, ...restProps }: Props) => {
  const sourceToken = values.tokens[0].token;
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

// ------------------------------------------
// Utils
// ------------------------------------------

function getWellTokenIndexes(well: BasinWell | undefined, bean: Token) {
  const beanIndex = well?.tokens?.[0].equals(bean) ? 0 : 1;
  const nonBeanIndex = beanIndex === 0 ? 1 : 0;

  return {
    beanIndex,
    nonBeanIndex,
  } as const;
}

/**
 * We want to limit the next chained query to only run when the previous query is successful & has no errors.
 * Additionally, we don't want the next query start if the previous query is either loading or fetching.
 */
function getNextChainedQueryEnabled(query: Omit<UseQueryResult, 'data'>) {
  return (
    query.isSuccess && !query.isLoading && !query.isFetching && !query.isError
  );
}
// const swapAmountIn = removeOutQuery.data?.[sourceWellNonBeanIndex];

// const swapOutQuery = useQuery({
//   queryKey: queryKeys.swapOut(swapTokenIn, swapTokenOut, swapAmountIn),
//   queryFn: ({ signal }) => {
//     if (!swapTokenIn || !swapTokenOut || !swapAmountIn) return TokenValue.ZERO;
//     const controller = new AbortController();
//     signal.addEventListener('abort', () => controller.abort());

//     const params = sdk.zeroX.fetchQuote({
//       slippagePercentage: values.settings.slippage.toString(),
//       buyToken: swapTokenIn.address,
//       sellToken: swapTokenOut.address,
//       sellAmount: swapAmountIn.blockchainString,
//       mode: ""
//     })
//   },
//   enabled: !!swapTokenIn && !!swapTokenOut && swapAmountIn?.gt(0),
//   initialData: TokenValue.ZERO,
// });
