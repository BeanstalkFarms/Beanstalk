import {
  Accordion,
  AccordionDetails,
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Link,
  Stack,
} from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useConnect } from 'wagmi';
import BigNumber from 'bignumber.js';
import {
  FarmFromMode,
  FarmToMode,
  ERC20Token,
  NativeToken,
  BeanSwapNodeQuote,
  BeanSwapOperation,
  BeanstalkSDK,
} from '@beanstalk/sdk';
import {
  FormApprovingState,
  FormTokenStateNew as FormTokenState,
  SettingInput,
  SlippageSettingsFragment,
  SmartSubmitButton,
  TokenAdornment,
  TokenSelectDialog,
  TxnPreview,
  TxnSettings,
} from '~/components/Common/Form';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import TokenInputField from '~/components/Common/Form/TokenInputField';
import FarmModeField from '~/components/Common/Form/FarmModeField';
import { ZERO_BN } from '~/constants';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import { useSigner } from '~/hooks/ledger/useSigner';

import useAccount from '~/hooks/ledger/useAccount';
import { getTokenIndex, MinBN, tokenIshEqual } from '~/util';
import { IconSize } from '~/components/App/muiTheme';
import TransactionToast from '~/components/Common/TxnToast';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { optimizeFromMode } from '~/util/Farm';
import copy from '~/constants/copy';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import { ActionType } from '~/util/Actions';
import WarningIcon from '~/components/Common/Alert/WarningIcon';
import Row from '~/components/Common/Row';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import useSdk from '~/hooks/sdk';
import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import useGetBalancesUsedBySource from '~/hooks/beanstalk/useBalancesUsedBySource';
import { TokenInstance, useSwapTokens } from '~/hooks/beanstalk/useTokens';
import useQuoteWithParams, {
  QuoteHandlerResultNew,
  QuoteHandlerWithParams,
} from '~/hooks/ledger/useQuoteWithParams';
import { useMinTokensIn } from '~/hooks/beanstalk/useMinTokensIn';

/// ---------------------------------------------------------------

type ValidModesIn =
  | FarmFromMode.INTERNAL
  | FarmFromMode.EXTERNAL
  | FarmFromMode.INTERNAL_EXTERNAL;

type IBeanSwapQuote = {
  beanSwapQuote: BeanSwapNodeQuote | undefined;
};

type TokenOutFromState = FormTokenState & IBeanSwapQuote;

type SwapFormValues = {
  /** Multiple tokens can (eventually) be swapped into tokenOut */
  tokensIn: FormTokenState[];
  modeIn: ValidModesIn;
  /** One output token can be selected */
  tokenOut: TokenOutFromState;
  modeOut: FarmToMode;
  approving?: FormApprovingState;
  /** */
  settings: SlippageSettingsFragment;
};

type ISlippage = {
  slippage: number;
};

type QuoteResult = QuoteHandlerResultNew & {
  beanSwapQuote: BeanSwapNodeQuote | undefined;
};

type BeanSwapQuoteHandler = QuoteHandlerWithParams<ISlippage, QuoteResult>;

const QUOTE_SETTINGS = {
  ignoreSameToken: false,
};

const Quoting = (
  <CircularProgress
    variant="indeterminate"
    size="small"
    sx={{ width: 14, height: 14 }}
  />
);

const SwapForm: FC<
  FormikProps<SwapFormValues> & {
    balances: ReturnType<typeof useFarmerBalances>;
    beanstalk: BeanstalkSDK['contracts']['beanstalk'];
    tokenList: (ERC20Token | NativeToken)[];
    defaultValues: SwapFormValues;
  }
> = ({
  values,
  setFieldValue,
  isSubmitting,
  balances,
  beanstalk,
  tokenList,
  defaultValues,
  submitForm,
}) => {
  /// Tokens
  const { status } = useConnect();
  const account = useAccount();
  const sdk = useSdk();
  // This controls what options are show on the tokenin picker (All Balances, circulating, farm).
  const [fromOptions, setFromOptions] = useState<BalanceFrom[]>([
    BalanceFrom.TOTAL,
  ]);
  // This controls the actual value chosen for tokenIn
  const [balanceFromIn, setBalanceFromIn] = useState<BalanceFrom>(
    BalanceFrom.TOTAL
  );
  // This controls the actual value chosen for tokenOut
  const [balanceFromOut, setBalanceFromOut] = useState<BalanceFrom>(
    BalanceFrom.EXTERNAL
  );
  // This tracks whether this is an exact input or an exact output swap

  /// Derived values
  const stateIn = values.tokensIn[0];
  const tokenIn = stateIn.token;
  const modeIn = values.modeIn;
  const amountIn = stateIn.amount;
  const stateOut = values.tokenOut;
  const tokenOut = stateOut.token;
  const modeOut = values.modeOut;
  const amountOut = stateOut.amount;
  const tokensMatch = tokenIn === tokenOut;

  const noBalancesFound = useMemo(
    () => Object.keys(balances).length === 0,
    [balances]
  );

  const minTokenIn = useMinTokensIn(tokenIn, tokenOut);

  const [balanceIn, balanceInInput, balanceInMax] = useMemo(() => {
    const _balanceIn = balances[getTokenIndex(tokenIn)];
    if (tokensMatch) {
      const _balanceInMax =
        _balanceIn[modeIn === FarmFromMode.INTERNAL ? 'internal' : 'external'];
      return [_balanceIn, _balanceInMax, _balanceInMax] as const;
    }
    return [_balanceIn, _balanceIn, _balanceIn?.total || ZERO_BN] as const;
  }, [balances, modeIn, tokenIn, tokensMatch]);

  const [getAmountsBySource] = useGetBalancesUsedBySource({
    tokens: values.tokensIn,
    mode: modeIn,
  });

  const amountsBySource = useMemo(
    () => getAmountsBySource(),
    [getAmountsBySource]
  );

  // Control what balances are shown in the token selector (internal/external/total)
  useEffect(() => {
    // if tokens match, then we want to allow picking different balanceFrom options
    if (tokensMatch) {
      setFromOptions([BalanceFrom.INTERNAL, BalanceFrom.EXTERNAL]);
      setBalanceFromIn(
        modeIn === FarmFromMode.INTERNAL
          ? BalanceFrom.INTERNAL
          : BalanceFrom.EXTERNAL
      );
      setFieldValue(
        'modeIn',
        modeIn === FarmFromMode.INTERNAL
          ? FarmFromMode.INTERNAL
          : FarmFromMode.EXTERNAL
      );
    } else if (tokenIn.equals(sdk.tokens.ETH)) {
      setFromOptions([BalanceFrom.EXTERNAL]);
    } else {
      setFromOptions([BalanceFrom.TOTAL]);
      setBalanceFromIn(BalanceFrom.TOTAL);
      setFieldValue('modeIn', FarmFromMode.INTERNAL_EXTERNAL);
    }
  }, [tokensMatch, modeIn, modeOut, tokenIn, sdk, setFieldValue]);

  const noBalance = !balanceInMax?.gt(0);
  const expectedFromMode = balanceIn
    ? optimizeFromMode(
        /// Manually set a maximum of `total` to prevent
        /// throwing INTERNAL_EXTERNAL_TOLERANT error.
        MinBN(amountIn || ZERO_BN, balanceIn.total),
        balanceIn
      )
    : FarmFromMode.INTERNAL;

  const shouldApprove = tokensMatch
    ? /// If matching tokens, only approve if input token is using EXTERNAL balances.
      modeIn === FarmFromMode.EXTERNAL
    : /// Otherwise, approve if we expect to use an EXTERNAL balance.
      expectedFromMode === FarmFromMode.EXTERNAL ||
      expectedFromMode === FarmFromMode.INTERNAL_EXTERNAL;

  const handleQuote = useCallback<BeanSwapQuoteHandler>(
    async (inputToken, _amountIn, targetToken, { slippage }) => {
      if (!account) throw new Error('Connect a wallet first.');
      if (_amountIn.lte(0)) {
        return {
          amountOut: ZERO_BN,
          beanSwapQuote: undefined,
        };
      }

      const quoteData = await sdk.beanSwap.quoter.route(
        inputToken,
        targetToken,
        inputToken.fromHuman(_amountIn.toString()),
        slippage
      );

      if (!quoteData) {
        throw new Error('No route found.');
      }

      const output = new BigNumber(quoteData.buyAmount.toHuman());

      return {
        amountOut: output,
        beanSwapQuote: quoteData,
      };
    },
    [account, sdk]
  );

  const quoterParams = useMemo(
    () => ({ slippage: values.settings.slippage }),
    [values.settings.slippage]
  );

  // eslint-disable-next-line unused-imports/no-unused-vars
  const optimizedFromMode = useMemo(
    () =>
      balanceIn
        ? optimizeFromMode(
            /// Manually set a maximum of `total` to prevent
            /// throwing INTERNAL_EXTERNAL_TOLERANT error.
            MinBN(amountIn || ZERO_BN, balanceIn.total),
            balanceIn
          )
        : FarmFromMode.INTERNAL,
    [balanceIn, amountIn]
  );

  /// Memoize to prevent infinite loop on useQuote
  const [resultOut, quotingOut, getAmountOut] = useQuoteWithParams<
    ISlippage,
    QuoteResult
  >(tokenOut, handleQuote, QUOTE_SETTINGS);

  const handleSetDefault = useCallback(() => {
    setFieldValue('modeIn', defaultValues.modeIn);
    setFieldValue('modeOut', defaultValues.modeOut);
    setFieldValue('tokensIn.0', { ...defaultValues.tokensIn[0] });
    setFieldValue('tokensIn.0.beanSwapQuote', undefined);
    setFieldValue('tokenOut', { ...defaultValues.tokenOut });
    setBalanceFromIn(BalanceFrom.TOTAL);
    setFromOptions([BalanceFrom.TOTAL]);
  }, [defaultValues, setFieldValue]);

  /// reset to default values when user switches wallet addresses or disconnects
  useEffect(() => {
    handleSetDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, status]);

  /// When receiving new results from quote handlers, update
  useEffect(() => {
    console.debug('[TokenInput] got new resultOut', resultOut);
    setFieldValue('tokenOut.amount', resultOut?.amountOut);
    setFieldValue('tokenOut.beanSwapQuote', resultOut?.beanSwapQuote);
  }, [setFieldValue, resultOut]);

  // If there is no amountIn for the tokenIn, reset the amountOut
  useEffect(() => {
    if (!amountOut) return;
    if (!amountIn || amountIn.eq(0)) {
      setFieldValue('tokenOut.amount', undefined);
    }
  }, [amountOut, setFieldValue, amountIn]);

  // If tokenIn or tokenOut changes, recalculate the user's desired input/output
  useEffect(() => {
    if (amountIn) {
      getAmountOut(tokenIn, amountIn, quoterParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenIn, tokenOut]);

  //
  const handleInputFromMode = useCallback(
    (v: BalanceFrom) => {
      // Picked Farm balance
      if (v === BalanceFrom.INTERNAL) {
        setFieldValue('modeIn', FarmToMode.INTERNAL);
        setFieldValue('modeOut', FarmToMode.EXTERNAL);
        setBalanceFromOut(BalanceFrom.EXTERNAL);
      }
      // Picked Ciruclating Balance
      else if (v === BalanceFrom.EXTERNAL) {
        setFieldValue('modeIn', FarmToMode.EXTERNAL);
        setFieldValue('modeOut', FarmToMode.INTERNAL);
        setBalanceFromOut(BalanceFrom.INTERNAL);
      }
      // Picked Combined Balance
      else if (v === BalanceFrom.TOTAL) {
        setFieldValue('modeIn', FarmFromMode.INTERNAL_EXTERNAL);
      }
    },
    [setFieldValue]
  );
  const handleChangeModeOut = useCallback(
    (v: FarmToMode) => {
      const newModeIn =
        v === FarmToMode.INTERNAL
          ? FarmFromMode.EXTERNAL
          : FarmFromMode.INTERNAL;
      setFieldValue('modeIn', newModeIn);
      setBalanceFromOut(
        v === FarmToMode.INTERNAL ? BalanceFrom.INTERNAL : BalanceFrom.EXTERNAL
      );
    },
    [setFieldValue]
  );

  /// When amountIn changes, refresh amountOut
  /// Only refresh if amountIn was changed by user input,
  /// i.e. not by another hook
  const handleChangeAmountIn = useCallback(
    (_amountInClamped: BigNumber | undefined) => {
      console.debug('[TokenInput] handleChangeAmountIn', _amountInClamped);
      if (_amountInClamped && !_amountInClamped?.isNaN()) {
        getAmountOut(tokenIn, _amountInClamped, quoterParams);
      } else {
        setFieldValue('tokenOut.amount', undefined);
      }
    },
    [tokenIn, quoterParams, getAmountOut, setFieldValue]
  );

  /// Token Select
  const [tokenSelect, setTokenSelect] = useState<
    null | 'tokensIn' | 'tokenOut'
  >(null);
  const selectedTokens =
    tokenSelect === 'tokenOut'
      ? [tokenOut]
      : tokenSelect === 'tokensIn'
        ? values.tokensIn.map((x) => x.token)
        : [];
  const handleCloseTokenSelect = useCallback(() => setTokenSelect(null), []);
  const handleShowTokenSelect = useCallback(
    (which: 'tokensIn' | 'tokenOut') => () => setTokenSelect(which),
    []
  );

  const setInitialModes = useCallback(() => {
    /// If user has an INTERNAL balance of the selected token,
    /// or if they have no balance at all, always show INTERNAL->EXTERNAL.
    /// Otherwise show the reverse.
    if (modeIn.toString() === modeOut.toString()) {
      setFieldValue('modeIn', FarmFromMode.EXTERNAL);
      setFieldValue('modeOut', FarmFromMode.INTERNAL);
      setBalanceFromOut(BalanceFrom.INTERNAL);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balanceIn, setFieldValue]);

  const handleReverse = useCallback(() => {
    if (tokensMatch) {
      /// Flip destinations.
      setFieldValue('modeIn', modeOut);
      setFieldValue('modeOut', modeIn);
    } else {
      setFieldValue('tokensIn.0', { ...values.tokenOut });
      setFieldValue('tokenOut', {
        ...values.tokensIn[0],
        amount: undefined,
      });
    }
  }, [
    modeIn,
    modeOut,
    setFieldValue,
    tokensMatch,
    values.tokenOut,
    values.tokensIn,
  ]);

  // if tokenIn && tokenOut are equal and no balances are found, reverse positions.
  // This prevents setting of internal balance of given token when there is none
  const handleTokensEqual = useCallback(() => {
    if (!noBalancesFound) {
      setInitialModes();
      return;
    }
    try {
      handleReverse();
    } catch {
      handleSetDefault();
    }
  }, [noBalancesFound, handleReverse, handleSetDefault, setInitialModes]);

  const handleTokenSelectSubmit = useCallback(
    (_tokens: Set<TokenInstance>) => {
      if (tokenSelect === 'tokenOut') {
        const newTokenOut = Array.from(_tokens)[0];
        if (tokenIn === newTokenOut) handleTokensEqual();
        setFieldValue('tokenOut.token', newTokenOut);
      } else if (tokenSelect === 'tokensIn') {
        const newTokenIn = Array.from(_tokens)[0];
        setFieldValue('tokensIn.0.token', newTokenIn);
        if (newTokenIn === tokenOut) handleTokensEqual();
      }
    },
    [setFieldValue, handleTokensEqual, tokenSelect, tokenIn, tokenOut]
  );

  const handleMax = useCallback(() => {
    setFieldValue('tokensIn.0.amount', balanceInMax);
    getAmountOut(tokenIn, balanceInMax, quoterParams);
  }, [balanceInMax, quoterParams, getAmountOut, setFieldValue, tokenIn]);

  /// Checks
  const isQuoting = quotingOut;
  const ethModeCheck =
    /// If ETH is selected as an output, the only possible destination is EXTERNAL.
    tokenOut.equals(sdk.tokens.ETH) ? modeOut === FarmToMode.EXTERNAL : true;
  const amountsCheck = amountIn?.gt(0) && amountOut?.gt(0);
  const diffModeCheck = tokensMatch
    ? modeIn.valueOf() !== modeOut.valueOf() // compare string enum vals
    : true;
  const enoughBalanceCheck = amountIn
    ? amountIn.gt(0) && balanceInMax.gte(amountIn)
    : true;
  const isValid =
    ethModeCheck && amountsCheck && diffModeCheck && enoughBalanceCheck;

  const handleSubmitWrapper = useCallback(
    (e: React.FormEvent) => {
      // Note: We need to wrap the formik handler to set the swapOperation form value first
      e.preventDefault();
      // setFieldValue('swapOperation', swapOperation);
      submitForm();
    },
    [submitForm]
  );

  return (
    <Form autoComplete="off" onSubmit={handleSubmitWrapper}>
      <TokenSelectDialog
        title="Select Input Token"
        open={tokenSelect === 'tokensIn'} // only open for the TokenIn input
        handleClose={handleCloseTokenSelect} //
        handleSubmit={handleTokenSelectSubmit} //
        selected={selectedTokens}
        balances={balances}
        balanceFrom={balanceFromIn}
        setBalanceFrom={handleInputFromMode}
        balanceFromOptions={fromOptions}
        tokenList={tokenList}
        mode={TokenSelectMode.SINGLE}
      />
      <TokenSelectDialog
        title="Select Output Token"
        open={tokenSelect === 'tokenOut'}
        handleClose={handleCloseTokenSelect} //
        handleSubmit={handleTokenSelectSubmit} //
        selected={selectedTokens}
        balances={balances}
        balanceFrom={balanceFromOut}
        balanceFromOptions={[BalanceFrom.EXTERNAL, BalanceFrom.INTERNAL]}
        tokenList={tokenList}
        mode={TokenSelectMode.SINGLE}
      />
      <Stack gap={1}>
        {/* Input */}
        <>
          <TokenInputField
            token={tokenIn}
            name="tokensIn.0.amount"
            // MUI
            fullWidth
            InputProps={{
              endAdornment: (
                <TokenAdornment
                  balanceFrom={balanceFromIn}
                  token={tokenIn}
                  onClick={handleShowTokenSelect('tokensIn')}
                />
              ),
            }}
            balanceLabel={
              tokensMatch
                ? copy.MODES[
                    modeIn as FarmFromMode.INTERNAL | FarmFromMode.EXTERNAL
                  ]
                : undefined
            }
            min={minTokenIn}
            balance={balanceInInput}
            quote={quotingOut ? Quoting : undefined}
            onChange={handleChangeAmountIn}
            error={!noBalance && !enoughBalanceCheck}
          />
        </>
        <Row justifyContent="center" mt={-1}>
          <IconButton onClick={handleReverse} size="small">
            <ExpandMoreIcon color="secondary" width={IconSize.xs} />
          </IconButton>
        </Row>
        {/* Output */}
        <>
          <TokenInputField
            token={tokenOut}
            name="tokenOut.amount"
            // MUI
            fullWidth
            InputProps={{
              endAdornment: (
                <TokenAdornment
                  token={tokenOut}
                  balanceFrom={balanceFromOut}
                  onClick={handleShowTokenSelect('tokenOut')}
                />
              ),
            }}
            outputOnlyMode
          />
          <FarmModeField
            name="modeOut"
            label="Destination"
            baseMode={FarmToMode}
            onChange={handleChangeModeOut}
          />
        </>
        {/* Warnings */}
        {ethModeCheck === false ? (
          <Alert variant="standard" color="warning" icon={<WarningIcon />}>
            ETH can only be delivered to your Circulating Balance.&nbsp;
            <Link
              onClick={() => {
                setFieldValue('modeOut', FarmToMode.EXTERNAL);
              }}
              sx={{ cursor: 'pointer' }}
              underline="hover"
            >
              Switch &rarr;
            </Link>
          </Alert>
        ) : null}
        {diffModeCheck === false ? (
          <Alert variant="standard" color="warning" icon={<WarningIcon />}>
            Please choose a different source or destination.
          </Alert>
        ) : null}
        {/**
         * If the user has some balance of the input token, but derives
         * an `amountIn` that is too high by typing in the second input,
         * show a message and prompt them to use `max`.
         */}
        {!noBalance && !enoughBalanceCheck && amountsCheck ? (
          <Alert variant="standard" color="warning" icon={<WarningIcon />}>
            Not enough {tokenIn.symbol}
            {tokensMatch ? ` in your ${copy.MODES[modeIn]}` : ''} to execute
            this transaction.&nbsp;
            <Link
              onClick={handleMax}
              sx={{
                display: 'inline-block',
                cursor: 'pointer',
                breakInside: 'avoid',
              }}
              underline="hover"
            >
              Use max &rarr;
            </Link>
          </Alert>
        ) : null}
        {isValid ? (
          <Box>
            <Accordion variant="outlined">
              <StyledAccordionSummary title="Transaction Details" />
              <AccordionDetails>
                <TxnPreview
                  actions={
                    tokensMatch
                      ? [
                          {
                            type: ActionType.TRANSFER_BALANCE,
                            amount: amountIn!,
                            token: tokenIn,
                            source: modeIn,
                            destination: modeOut,
                          },
                        ]
                      : [
                          {
                            type: ActionType.SWAP,
                            amountsBySource: amountsBySource?.[0] || undefined,
                            tokenIn: tokenIn,
                            source: modeIn,
                            amountIn: amountIn!,
                            amountOut: amountOut!,
                            tokenOut: tokenOut,
                          },
                          {
                            type: ActionType.RECEIVE_TOKEN,
                            amount: amountOut!,
                            token: tokenOut,
                            destination: modeOut,
                          },
                        ]
                  }
                />
              </AccordionDetails>
            </Accordion>
          </Box>
        ) : null}
        <SmartSubmitButton
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          loading={isSubmitting}
          disabled={!isValid || isSubmitting || isQuoting}
          contract={beanstalk}
          tokens={shouldApprove ? values.tokensIn : []}
          mode="auto"
        >
          {noBalance
            ? 'Nothing to swap'
            : // : !enoughBalanceCheck
              // ? 'Not enough to swap'
              'Swap'}
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

// ---------------------------------------------------

const Swap: FC<{}> = () => {
  /// Ledger
  const { data: signer } = useSigner();
  const beanstalk = useBeanstalkContract(signer);
  const account = useAccount();
  const sdk = useSdk();

  if (!sdk) {
    throw new Error('Sdk not initialized');
  }

  const tokenList = useSwapTokens();

  /// Farmer
  const farmerBalances = useFarmerBalances();
  const [refetchFarmerBalances] = useFetchFarmerBalances();

  /// Form
  const middleware = useFormMiddleware();
  const initialValues: SwapFormValues = useMemo(
    () => ({
      tokensIn: [
        {
          token: sdk.tokens.ETH,
          amount: undefined,
        },
      ],
      modeIn: FarmFromMode.EXTERNAL,
      tokenOut: {
        token: sdk.tokens.BEAN,
        beanSwapQuote: undefined,
        amount: undefined,
      },
      modeOut: FarmToMode.EXTERNAL,
      settings: {
        slippage: 0.1,
      },
    }),
    [sdk.tokens]
  );

  const onSubmit = useCallback(
    async (
      values: SwapFormValues,
      formActions: FormikHelpers<SwapFormValues>
    ) => {
      const txToast = new TransactionToast({
        loading: 'Swapping...',
        success: 'Swap successful.',
      });

      try {
        middleware.before();
        const { operation, tokenIn, tokenOut } = getBeanSwapOperation(
          values,
          account
        );

        let gas;
        try {
          gas = await operation.estimateGas();
        } catch (err) {
          console.warn(
            'Failed to estimate gas: ',
            (err as unknown as Error).message
          );
        }

        const txn = await operation.execute({
          gasLimit: gas?.mul(1.1).toBigNumber(),
        });
        txToast.confirming(txn);

        const receipt = await txn.wait();
        await refetchFarmerBalances();
        txToast.success(receipt);
        // formActions.resetForm();
        formActions.setFieldValue('tokensIn.0', {
          token: tokenIn,
          amount: undefined,
        });
        formActions.setFieldValue('tokenOut', {
          token: tokenOut,
          amount: undefined,
          beanSwapQuote: undefined,
        });
      } catch (err) {
        txToast.error(err);
        formActions.setSubmitting(false);
      }
    },
    [account, refetchFarmerBalances, middleware]
  );

  return (
    <Formik<SwapFormValues>
      enableReinitialize
      initialValues={initialValues}
      onSubmit={onSubmit}
    >
      {(formikProps: FormikProps<SwapFormValues>) => (
        <>
          <TxnSettings placement="form-top-right">
            <SettingInput
              name="settings.slippage"
              label="Slippage Tolerance"
              endAdornment="%"
            />
          </TxnSettings>
          <SwapForm
            balances={farmerBalances}
            beanstalk={beanstalk}
            tokenList={tokenList}
            defaultValues={initialValues}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

export default Swap;

function getBeanSwapOperation(
  values: SwapFormValues,
  account: string | undefined
) {
  const stateIn = values.tokensIn[0];
  const stateOut = values.tokenOut;
  const quote = stateOut.beanSwapQuote;

  const tokenIn = stateIn.token;
  const tokenOut = stateOut.token;
  const amountIn = stateIn.amount;
  const amountOut = stateOut.amount;
  const formSlippage = values.settings.slippage;

  if (!account) throw new Error('Connect a wallet first.');
  if (!amountIn) throw new Error('No input amount set.');
  if (!amountOut) {
    throw new Error('Error w/ quote. No output amount set.');
  }
  if (!quote) {
    throw new Error("Can't swap without a quote.");
  }
  if (!tokenIshEqual(tokenIn, quote.sellToken)) {
    throw new Error(
      'Input token does not match quote. Please refresh the quote.'
    );
  }
  if (!tokenIshEqual(tokenOut, quote.buyToken)) {
    throw new Error(
      'Output token does not match quote. Please refresh the quote.'
    );
  }
  if (!amountIn.eq(quote.sellAmount.toHuman())) {
    throw new Error(
      "Input amount doesn't match quote. Please refresh the quote."
    );
  }
  if (!amountOut.eq(quote.buyAmount.toHuman())) {
    throw new Error(
      "Output amount doesn't match quote. Please refresh the quote."
    );
  }
  if (quote.slippage !== formSlippage) {
    throw new Error("Slippage doesn't match quote. Please refresh the quote.");
  }

  const operation = BeanSwapOperation.buildWithQuote(
    quote,
    account,
    account,
    values.modeIn,
    values.modeOut
  );

  return { operation, tokenIn, tokenOut };
}
