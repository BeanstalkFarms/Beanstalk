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
import { ethers } from 'ethers';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useConnect } from 'wagmi';
import BigNumber from 'bignumber.js';
import { SwapOperation, FarmFromMode, FarmToMode } from '@beanstalk/sdk';
import {
  FormApprovingState,
  FormTokenState,
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
import Token, { ERC20Token, NativeToken } from '~/classes/Token';
import { Beanstalk } from '~/generated/index';
import { ZERO_BN } from '~/constants';
import { BEAN, CRV3, DAI, ETH, USDC, USDT, WETH } from '~/constants/tokens';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import useTokenMap from '~/hooks/chain/useTokenMap';
import { useSigner } from '~/hooks/ledger/useSigner';

import useGetChainToken from '~/hooks/chain/useGetChainToken';
import useQuote, { QuoteHandler } from '~/hooks/ledger/useQuote';
import useAccount from '~/hooks/ledger/useAccount';
import { toStringBaseUnitBN, toTokenUnitsBN, MinBN } from '~/util';
import { IconSize } from '~/components/App/muiTheme';
import TransactionToast from '~/components/Common/TxnToast';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import useChainConstant from '~/hooks/chain/useChainConstant';
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

/// ---------------------------------------------------------------

type SwapFormValues = {
  /** Multiple tokens can (eventually) be swapped into tokenOut */
  tokensIn: FormTokenState[];
  balanceFrom: BalanceFrom;
  modeIn: FarmFromMode.INTERNAL | FarmFromMode.EXTERNAL;
  /** One output token can be selected */
  tokenOut: FormTokenState;
  modeOut: FarmToMode;
  approving?: FormApprovingState;
  /** */
  settings: SlippageSettingsFragment;
  swapOperation: SwapOperation;
};

type DirectionalQuoteHandler = (
  direction: 'forward' | 'backward',
  swapOperation: SwapOperation
) => QuoteHandler;

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
    beanstalk: Beanstalk;
    handleQuote: DirectionalQuoteHandler;
    tokenList: (ERC20Token | NativeToken)[];
    defaultValues: SwapFormValues;
  }
> = ({
  values,
  setFieldValue,
  handleQuote,
  isSubmitting,
  balances,
  beanstalk,
  tokenList,
  defaultValues,
  submitForm,
}) => {
  /// Tokens
  const Eth = useChainConstant(ETH);
  const { status } = useConnect();
  const account = useAccount();
  const sdk = useSdk();

  const [fromOptions, setFromOptions] = useState<BalanceFrom[]>([
    BalanceFrom.TOTAL,
  ]);

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
  const [balanceIn, balanceInInput, balanceInMax] = useMemo(() => {
    const _balanceIn = balances[tokenIn.address];
    if (tokensMatch) {
      const _balanceInMax =
        _balanceIn[modeIn === FarmFromMode.INTERNAL ? 'internal' : 'external'];
      return [_balanceIn, _balanceInMax, _balanceInMax] as const;
    }
    return [_balanceIn, _balanceIn, _balanceIn?.total || ZERO_BN] as const;
  }, [balances, modeIn, tokenIn.address, tokensMatch]);

  useEffect(() => {
    // if tokens match, then we want to allow picking different balanceFrom options
    if (tokensMatch) {
      setFromOptions([
        modeIn === FarmFromMode.INTERNAL
          ? BalanceFrom.INTERNAL
          : BalanceFrom.EXTERNAL,
      ]);
      setFieldValue(
        'balanceFrom',
        modeIn === FarmFromMode.INTERNAL
          ? BalanceFrom.INTERNAL
          : BalanceFrom.EXTERNAL
      );
    } else {
      setFromOptions([BalanceFrom.TOTAL]);
      setFieldValue('balanceFrom', BalanceFrom.TOTAL);
    }
  }, [tokensMatch, modeIn, modeOut, setFieldValue]);

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

  const buildSwapHelper = useCallback(
    (
      uiTokenIn: Token,
      uiTokenOut: Token,
      farmFrom: FarmFromMode,
      farmTo: FarmToMode
    ) => {
      const sdkTokenIn = sdk.tokens.findByAddress(uiTokenIn.address);
      if (!sdkTokenIn) {
        throw new Error(
          `Address of ${uiTokenIn.symbol} was not found in SDK tokens.`
        );
      }
      const sdkTokenOut = sdk.tokens.findByAddress(uiTokenOut.address);
      if (!sdkTokenOut) {
        throw new Error(
          `Address of ${uiTokenOut.symbol} was not found in SDK tokens.`
        );
      }

      return sdk.swap.buildSwap(
        sdkTokenIn,
        sdkTokenOut,
        account!,
        farmFrom,
        farmTo
      );
    },
    [sdk.tokens, sdk.swap, account]
  );

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

  const swapOperation = useMemo(
    () => buildSwapHelper(tokenIn, tokenOut, optimizedFromMode, modeOut),
    [buildSwapHelper, optimizedFromMode, tokenIn, tokenOut, modeOut]
  );

  /// Memoize to prevent infinite loop on useQuote
  const handleBackward = useMemo(
    () => handleQuote('backward', swapOperation),
    [handleQuote, swapOperation]
  );
  const handleForward = useMemo(
    () => handleQuote('forward', swapOperation),
    [handleQuote, swapOperation]
  );
  const [resultIn, quotingIn, getMinAmountIn] = useQuote(
    tokenIn,
    handleBackward,
    QUOTE_SETTINGS
  );
  const [resultOut, quotingOut, getAmountOut] = useQuote(
    tokenOut,
    handleForward,
    QUOTE_SETTINGS
  );

  const handleSetDefault = useCallback(() => {
    setFieldValue('modeIn', defaultValues.modeIn);
    setFieldValue('modeOut', defaultValues.modeOut);
    setFieldValue('tokensIn.0', { ...defaultValues.tokensIn[0] });
    setFieldValue('tokenOut', { ...defaultValues.tokenOut });
    setFieldValue('balanceFrom', BalanceFrom.TOTAL);
    setFromOptions([BalanceFrom.TOTAL]);
  }, [defaultValues, setFieldValue]);

  /// reset to default values when user switches wallet addresses or disconnects
  useEffect(() => {
    handleSetDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, status]);

  /// When receiving new results from quote handlers, update
  /// the respective form fields.
  useEffect(() => {
    console.debug('[TokenInput] got new resultIn', resultIn);
    setFieldValue('tokensIn.0.amount', resultIn?.amountOut);
  }, [setFieldValue, resultIn]);
  useEffect(() => {
    console.debug('[TokenInput] got new resultOut', resultOut);
    setFieldValue('tokenOut.amount', resultOut?.amountOut);
  }, [setFieldValue, resultOut]);

  const handleChangeModeIn = useCallback(
    (v: FarmFromMode) => {
      const newModeOut =
        v === FarmFromMode.INTERNAL ? FarmToMode.EXTERNAL : FarmToMode.INTERNAL;
      setFieldValue('modeOut', newModeOut);
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
        getAmountOut(tokenIn, _amountInClamped);
      } else {
        setFieldValue('tokenOut.amount', undefined);
      }
    },
    [tokenIn, getAmountOut, setFieldValue]
  );
  const handleChangeAmountOut = useCallback(
    (_amountOutClamped: BigNumber | undefined) => {
      console.debug('[TokenInput] handleChangeAmountOut', _amountOutClamped);
      if (_amountOutClamped && !_amountOutClamped?.isNaN()) {
        console.debug('[TokenInput] getMinAmountIn', [
          tokenOut,
          _amountOutClamped,
        ]);
        getMinAmountIn(tokenOut, _amountOutClamped);
      } else {
        setFieldValue('tokensIn.0.amount', undefined);
      }
    },
    [tokenOut, getMinAmountIn, setFieldValue]
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
    const [newModeIn, newModeOut] =
      !balanceIn || balanceIn.internal.gt(0) || balanceIn.total.eq(0)
        ? [FarmFromMode.INTERNAL, FarmToMode.EXTERNAL]
        : [FarmFromMode.EXTERNAL, FarmToMode.INTERNAL];
    setFieldValue('modeIn', newModeIn);
    setFieldValue('modeOut', newModeOut);
  }, [balanceIn, setFieldValue]);

  const handleReverse = useCallback(() => {
    if (tokensMatch) {
      /// Flip destinations.
      setFieldValue('modeIn', modeOut);
      setFieldValue('modeOut', modeIn);
    } else {
      setFieldValue('tokensIn.0', {
        token: tokenOut,
        amount: undefined,
      } as SwapFormValues['tokensIn'][number]);
      setFieldValue('tokenOut', {
        token: tokenIn,
        amount: undefined,
      });
    }
  }, [modeIn, modeOut, setFieldValue, tokenIn, tokenOut, tokensMatch]);

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
    (_tokens: Set<Token>) => {
      if (tokenSelect === 'tokenOut') {
        const newTokenOut = Array.from(_tokens)[0];
        setFieldValue('tokenOut', {
          token: newTokenOut,
          amount: undefined,
        });
        setFieldValue('tokensIn.0.amount', undefined);
        if (tokenIn === newTokenOut) handleTokensEqual();
      } else if (tokenSelect === 'tokensIn') {
        const newTokenIn = Array.from(_tokens)[0];
        setFieldValue('tokensIn.0', {
          token: newTokenIn,
          amount: undefined,
        });
        setFieldValue('tokenOut.amount', undefined);
        if (newTokenIn === tokenOut) handleTokensEqual();
      }
    },
    [setFieldValue, handleTokensEqual, tokenSelect, tokenIn, tokenOut]
  );

  const handleMax = useCallback(() => {
    setFieldValue('tokensIn.0.amount', balanceInMax);
    getAmountOut(tokenIn, balanceInMax);
  }, [balanceInMax, getAmountOut, setFieldValue, tokenIn]);

  /// Checks
  const isQuoting = quotingIn || quotingOut;
  const ethModeCheck =
    /// If ETH is selected as an output, the only possible destination is EXTERNAL.
    tokenOut === Eth ? modeOut === FarmToMode.EXTERNAL : true;
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
      setFieldValue('swapOperation', swapOperation);
      submitForm();
    },
    [setFieldValue, swapOperation, submitForm]
  );

  return (
    <Form autoComplete="off" onSubmit={handleSubmitWrapper}>
      <TokenSelectDialog
        title={
          tokenSelect === 'tokensIn'
            ? 'Select Input Token'
            : 'Select Output Token'
        }
        open={tokenSelect !== null} // 'tokensIn' | 'tokensOut'
        handleClose={handleCloseTokenSelect} //
        handleSubmit={handleTokenSelectSubmit} //
        selected={selectedTokens}
        balances={balances}
        balanceFrom={values.balanceFrom}
        balanceFromOptions={fromOptions}
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
                  balanceFrom={values.balanceFrom}
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
            balance={balanceInInput}
            disabled={
              quotingIn
              // || !pathwayCheck
            }
            quote={quotingOut ? Quoting : undefined}
            onChange={handleChangeAmountIn}
            error={!noBalance && !enoughBalanceCheck}
          />
          {tokensMatch ? (
            <FarmModeField
              name="modeIn"
              label="Source"
              baseMode={FarmFromMode}
              onChange={handleChangeModeIn}
            />
          ) : null}
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
                  onClick={handleShowTokenSelect('tokenOut')}
                />
              ),
            }}
            disabled={
              /// Disable while quoting an `amount` for the output.
              quotingOut ||
              /// Can't type into the output field if
              /// user has no balance of the input.
              noBalance
              /// No way to quote for this pathway
              // || !pathwayCheck
            }
            quote={quotingIn ? Quoting : undefined}
            onChange={handleChangeAmountOut}
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
        {/**
         * After the upgrade to `handleChangeModeIn` / `handleChangeModeOut`
         * this should never be true. */}
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
                            tokenIn: tokenIn,
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

const SUPPORTED_TOKENS = [BEAN, ETH, WETH, CRV3, DAI, USDC, USDT];

/**
 * SWAP
 * Implementation notes
 *
 * BEAN + ETH
 * ---------------
 * BEAN   -> ETH      exchange_underlying(BEAN, USDT) => exchange(USDT, WETH) => unwrapEth
 * BEAN   -> WETH     exchange_underlying(BEAN, USDT) => exchange(USDT, WETH)
 * ETH    -> BEAN     wrapEth => exchange(WETH, USDT) => exchange_underlying(USDT, BEAN)
 * WETH   -> BEAN     exchange(WETH, USDT) => exchange_underlying(USDT, BEAN)
 *
 * BEAN + Stables
 * ---------------------
 * BEAN   -> DAI      exchange_underlying(BEAN, DAI, BEAN_METAPOOL)
 * BEAN   -> USDT     exchange_underlying(BEAN, USDT, BEAN_METAPOOL)
 * BEAN   -> USDC     exchange_underlying(BEAN, USDC, BEAN_METAPOOL)
 * BEAN   -> 3CRV     exchange(BEAN, 3CRV, BEAN_METAPOOL)
 * DAI    -> BEAN     exchange_underlying(DAI,  BEAN, BEAN_METAPOOL)
 * USDT   -> BEAN     exchange_underlying(BEAN, USDT, BEAN_METAPOOL)
 * USDC   -> BEAN     exchange_underlying(BEAN, USDC, BEAN_METAPOOL)
 * 3CRV   -> BEAN     exchange(3CRV, BEAN, BEAN_METAPOOL)
 *
 * Internal <-> External
 * ---------------------
 * TOK-i  -> TOK-e    transferToken(TOK, self, amount, INTERNAL, EXTERNAL)
 * TOK-e  -> TOK-i    transferToken(TOK, self, amount, EXTERNAL, INTERNAL)
 *
 * Stables
 * ---------------------
 * USDC   -> USDT     exchange(USDC, USDT, 3POOL)
 * ...etc
 */

const Swap: FC<{}> = () => {
  /// Ledger
  const { data: signer } = useSigner();
  const beanstalk = useBeanstalkContract(signer);
  const account = useAccount();
  const sdk = useSdk();

  if (!sdk) {
    throw new Error('Sdk not initialized');
  }

  /// Tokens
  const getChainToken = useGetChainToken();
  const Eth = getChainToken(ETH);
  const Bean = getChainToken(BEAN);

  /// Token List
  const tokenMap = useTokenMap<ERC20Token | NativeToken>(SUPPORTED_TOKENS);
  const tokenList = useMemo(() => Object.values(tokenMap), [tokenMap]);

  /// Farmer
  const farmerBalances = useFarmerBalances();
  const [refetchFarmerBalances] = useFetchFarmerBalances();

  /// Form
  const middleware = useFormMiddleware();
  const initialValues: SwapFormValues = useMemo(
    () => ({
      tokensIn: [
        {
          token: Eth,
          amount: undefined,
        },
      ],
      modeIn: FarmFromMode.EXTERNAL,
      balanceFrom: BalanceFrom.TOTAL,
      tokenOut: {
        token: Bean,
        amount: undefined,
      },
      modeOut: FarmToMode.EXTERNAL,
      settings: {
        slippage: 0.1,
      },
      swapOperation: sdk.swap.buildSwap(
        sdk.tokens.ETH,
        sdk.tokens.BEAN,
        account!,
        FarmFromMode.EXTERNAL,
        FarmToMode.EXTERNAL
      ),
    }),
    [Bean, Eth, account, sdk.swap, sdk.tokens]
  );

  /// Handlers
  const handleQuote = useCallback<DirectionalQuoteHandler>(
    (direction, swapOperation) => async (__tokenIn, _amountIn, __tokenOut) => {
      console.debug('[handleQuoteWithSdk] ', {
        direction,
        _amountIn,
        swapOperationPath: swapOperation.getDisplay(),
      });
      if (!account) throw new Error('Connect a wallet first.');

      const forward: Boolean = direction === 'forward';

      const amountIn = forward
        ? ethers.BigNumber.from(
            toStringBaseUnitBN(_amountIn, swapOperation.tokenIn.decimals)
          )
        : ethers.BigNumber.from(
            toStringBaseUnitBN(_amountIn, swapOperation.tokenOut.decimals)
          );

      const estimate = forward
        ? await swapOperation.estimate(amountIn)
        : await swapOperation.estimateReversed(amountIn);

      return {
        amountOut: toTokenUnitsBN(
          estimate.toBlockchain(),
          forward
            ? swapOperation.tokenOut.decimals
            : swapOperation.tokenIn.decimals
        ),
      };
    },
    [account]
  );

  const onSubmit = useCallback(
    async (
      values: SwapFormValues,
      formActions: FormikHelpers<SwapFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();
        const stateIn = values.tokensIn[0];
        const tokenIn = stateIn.token;
        const stateOut = values.tokenOut;
        const tokenOut = stateOut.token;
        if (!stateIn.amount) throw new Error('No input amount set.');
        if (!account) throw new Error('Connect a wallet first.');
        const amountIn = ethers.BigNumber.from(
          stateIn.token.stringify(stateIn.amount)
        );

        txToast = new TransactionToast({
          loading: 'Swapping...',
          success: 'Swap successful.',
        });
        let gas;
        try {
          gas = await values.swapOperation.estimateGas(
            amountIn,
            values.settings.slippage
          );
        } catch (err) {
          console.warn(
            'Failed to estimate gas: ',
            (err as unknown as Error).message
          );
        }
        const txn = await values.swapOperation.execute(
          amountIn,
          values.settings.slippage,
          { gasLimit: gas?.mul(1.1).toBigNumber() }
        );
        txToast.confirming(txn);

        const receipt = await txn.wait();
        await Promise.all([refetchFarmerBalances()]);
        txToast.success(receipt);
        // formActions.resetForm();
        formActions.setFieldValue('tokensIn.0', {
          token: tokenIn,
          amount: undefined,
        });
        formActions.setFieldValue('tokenOut', {
          token: tokenOut,
          amount: undefined,
        });
      } catch (err) {
        if (txToast) {
          txToast.error(err);
        } else {
          const errorToast = new TransactionToast({});
          errorToast.error(err);
        }
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
            handleQuote={handleQuote}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

export default Swap;
