import React from 'react';

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
import { BaseConvertFormProps } from './types';

interface Props extends BaseConvertFormProps {
  farmerBalances: TokenSiloBalance | undefined;
}

interface PipelineConvertFormProps extends Props {
  sourceWell: BasinWell;
  targetWell: BasinWell;
}

const baseQueryOptions = {
  staleTime: 20_000, // 20 seconds stale time
  refetchOnWindowFocus: true,
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
  const [tokenSelectOpen, showTokenSelect, hideTokenSelect] = useToggle();
  const getBDV = useBDV();

  const sourceToken = sourceWell.lpToken; // LP token of source well
  const targetToken = targetWell.lpToken; // LP token of target well
  const BEAN = sdk.tokens.BEAN;

  const debouncedAmountIn = useDebounce(values.tokens[0].amount ?? ZERO_BN); //

  const maxConvertableBN = new BigNumber(
    (balance?.convertibleAmount || TokenValue.ZERO).toHuman()
  );

  const sourceIdx = getWellTokenIndexes(sourceWell, BEAN); // token indexes of source well
  const targetIdx = getWellTokenIndexes(targetWell, BEAN); // token indexes of target well

  const sellToken = sourceWell.tokens[sourceIdx.nonBeanIndex]; // token we will sell when after removing liquidity in equal parts
  const buyToken = targetWell.tokens[targetIdx.nonBeanIndex]; // token we will buy to add liquidity

  const slippage = values.settings.slippage;

  // const amountOut = values.tokens[0].amountOut; // amount of to token
  // const maxAmountIn = values.maxAmountIn;
  // const canConvert = maxAmountIn?.gt(0) || false;
  // const plantCrate = plantAndDoX?.crate?.bn;

  // prettier-ignore
  const { data } = useQuery({
    queryKey: ['pipelineConvert', sourceWell.address, targetWell.address, debouncedAmountIn.toString()],
    queryFn: async () => {
      setFieldValue('tokens.0.quoting', true);
      try {
        const sourceLPAmountOut = await sourceWell.getRemoveLiquidityOutEqual(
          sourceWell.lpToken.fromHuman(debouncedAmountIn.toString())
        );

        console.debug(`[pipelineConvert/removeLiquidity (1)] result:`, {
          BEAN: sourceLPAmountOut[sourceIdx.beanIndex].toNumber(),
          [`${sellToken.symbol}`]: sourceLPAmountOut[sourceIdx.nonBeanIndex].toNumber(),
        });

        const beanAmountOut = sourceLPAmountOut[sourceIdx.beanIndex];
        const swapAmountIn = sourceLPAmountOut[sourceIdx.nonBeanIndex];

        const quote = await sdk.zeroX.fetchSwapQuote({
          sellToken: sellToken.address,
          buyToken: buyToken.address,
          sellAmount: swapAmountIn.blockchainString,
          takerAddress: sdk.contracts.pipeline.address,
          shouldSellEntireBalance: true,
          // 0x requests are formatted such that 0.01 = 1%. Everywhere else in the UI we use 0.01 = 0.01% ?? BS3TODO: VALIDATE ME
          slippagePercentage: (slippage / 10).toString(),
        });

        console.debug(`[pipelineConvert/0xQuote (2)] result:`, { quote });

        const swapAmountOut = buyToken.fromBlockchain(quote?.buyAmount || '0');
        const targetLPAmountOut = await targetWell.getAddLiquidityOut([
          beanAmountOut,
          swapAmountOut,
        ]);
        console.debug(`[pipelineConvert/addLiquidity (3)] result:`, {
          amount: targetLPAmountOut.toNumber(),
        });

        setFieldValue('tokens.0.amountOut', new BigNumber(targetLPAmountOut.toHuman()));
        return {
          beanAmountOut,
          swapAmountIn,
          swapAmountOut,
          quote,
          targetLPAmountOut,
        };
      } catch (e) {
        console.debug('[pipelineConvert/query] FAILED: ', e);
        throw e;
      } finally {
        setFieldValue('tokens.0.quoting', false);
      }
    },
    enabled: maxConvertableBN.gt(0) && debouncedAmountIn?.gt(0),
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

  // same as query.isFetching & query.isLoading
  const isQuoting = values.tokens?.[0]?.quoting;

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
          {/* You may Lose Grown Stalk warning here */}
          <Box>
            <WarningAlert iconSx={{ alignItems: 'flex-start' }}>
              You may lose Grown Stalk through this transaction.
            </WarningAlert>
          </Box>
          {debouncedAmountIn?.gt(0) && data?.targetLPAmountOut?.gt(0) && (
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
                        data?.targetLPAmountOut || ZERO_BN,
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
