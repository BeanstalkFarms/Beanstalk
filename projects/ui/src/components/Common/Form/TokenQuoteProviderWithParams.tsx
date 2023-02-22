import React, { useEffect, useMemo } from 'react';
import { CircularProgress, Typography } from '@mui/material';
import { useFormikContext } from 'formik';
import BigNumber from 'bignumber.js';
import { Token, ERC20Token, NativeToken } from '@beanstalk/sdk';
import TokenInputField, { TokenInputProps } from '~/components/Common/Form/TokenInputField';
import TokenAdornment from '~/components/Common/Form/TokenAdornment';
import { displayFullBN } from '~/util/Tokens';
import { FormStateNew, FormTokenStateNew } from '.';
import Row from '~/components/Common/Row';

import useQuoteWithParams, { QuoteHandlerWithParams, QuoteSettingsNew } from '~/hooks/ledger/useQuoteWithParams';
import { TokenQuoteProviderCustomProps } from './TokenQuoteProvider';
import useDeepCompareMemo from '~/hooks/ui/useDeepCompareMemo';

type TokenQuoteProviderWithParamsCustomProps<T> = {
    /** The current form state of this token */
    state: FormTokenStateNew;
    /** Token which we're quoting to. Required to display a proper `amountOut` below the input. */
    tokenOut: ERC20Token | NativeToken;
    /** */
    handleQuote: QuoteHandlerWithParams<T>;
    /** */
    displayQuote?: false | ((state: BigNumber | undefined, tokenOut: Token) => React.ReactElement | undefined)
    /** */
    quoteSettings?: Partial<QuoteSettingsNew>;
    /**
     * NOTE: MEMOIZE ME to prevent infinite render loop
     */
    params: T;
} & Omit<TokenQuoteProviderCustomProps, 'state' | 'tokenOut' | 'handleQuote' | 'quoteSettings' | 'displayQuote'>

type TokenQuoteWithParamsProviderProps<T> = 
  TokenQuoteProviderWithParamsCustomProps<T> 
  & Partial<TokenInputProps>;

const DefaultQuoteDisplay = (amountOut: BigNumber | undefined, tokenOut: Token) => (
  amountOut ? (
    <Typography variant="body1">
      ≈ {displayFullBN(amountOut, tokenOut.displayDecimals)} {tokenOut.symbol}
    </Typography>
  ) : undefined
);
/**
 * NOTE: This component is the same as TokenQuoteProvider except it takes in a `params` prop and 
 * to work with the new sdk types
 */
export default function TokenQuoteProviderWithParams<T>({
  /// Field
  name,
  state,
  balance,
  tokenOut,
  /// Token selection
  showTokenSelect,
  disableTokenSelect,
  tokenSelectLabel,
  /// Quoting
  handleQuote,
  displayQuote: _displayQuote,
  quoteSettings,
  /// Parameters,
  params: _params,
  ///
  /// Adornment
  // TokenAdornmentProps: _TokenAdornmentProps,
  /// Other props
  ...props

}: TokenQuoteWithParamsProviderProps<T>) {
  // Setup a price quote for this token
  const [result, quoting, getAmountOut] = useQuoteWithParams<T>(tokenOut, handleQuote, quoteSettings);
  const { isSubmitting, setFieldValue } = useFormikContext<FormStateNew>();
  const params = useDeepCompareMemo(() => _params, [_params]);

  const displayQuote = _displayQuote === undefined ? DefaultQuoteDisplay : _displayQuote;

  // Run getAmountOut when selected token changes.
  // ------------------------------------------
  // NOTE: because the getAmountOut function is debounced,
  // it returns undefined in some cases, so instead we 
  // listen for changes to `amountOut` and `quouting`
  // via effects and update form state accordingly.
  useEffect(() => {
    if (state.token.symbol !== tokenOut.symbol) {
      console.debug(`[TokenQuoteProvider] Inputs changed. Refreshing amount out: ${state.amount} ${state.token?.symbol} => X ${tokenOut.symbol}`);
      getAmountOut(
        state.token,                      // tokenIn
        new BigNumber(state.amount || 0),  // amountIn,
        params
      );
    }
  }, [
    params,
    state.token,
    state.amount,
    getAmountOut,
    tokenOut
  ]);

  // Store amountOut and quoting in form state.
  // ------------------------------------------
  // FIXME: Antipattern here? Should we have 
  // a version of `useQuote` that handles this automatically?
  useEffect(() => {
    console.debug(`[TokenQuoteProvider] update ${name}.amountOut =>`, result?.amountOut?.toString());
    setFieldValue(`${name}.amountOut`, result?.amountOut); // calculated amountOut
    setFieldValue(`${name}.value`, result?.value);  // ether value used
    setFieldValue(`${name}.workflow`, result?.workflow);  // workflow
  }, [name, setFieldValue, result]);
  useEffect(() => {
    console.debug(`[TokenQuoteProvider] update ${name}.quoting =>`, quoting);
    setFieldValue(`${name}.quoting`, quoting);
  }, [name, setFieldValue, quoting]);

  // Memoized token adornment
  const InputProps = useMemo(() => ({
    endAdornment: (
      <TokenAdornment
        token={state.token}
        onClick={showTokenSelect}
        disabled={isSubmitting || disableTokenSelect}
        size={props.size}
        buttonLabel={tokenSelectLabel}
        balanceFrom={props.balanceFrom}
        sx={{ opacity: disableTokenSelect ? 0.3 : 1 }}
      />
    )
  }), [state.token, showTokenSelect, isSubmitting, disableTokenSelect, props.size, props.balanceFrom, tokenSelectLabel]);

  // Render info about the quote beneath the input.
  // ----------------------------------------------
  // use state.amountOut instead of amountOut to hide Quote display
  // when the user switches selected tokens.
  const Quote = useMemo(() => (
    displayQuote ? (
      <Row gap={0.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
        {displayQuote(state.amountOut, tokenOut)}
        {quoting && (
          <CircularProgress variant="indeterminate" size="small" sx={{ width: 14, height: 14 }} />
        )}
      </Row>
    ) : undefined
  ), [displayQuote, state.amountOut, tokenOut, quoting]);

  return (  
    <TokenInputField
      name={`${name}.amount`}
      // MUI
      fullWidth
      InputProps={InputProps}
      {...props}
      // Other
      balance={balance}
      balanceFrom={props.balanceFrom}
      quote={props.quote || Quote}
      token={state.token}
    />
  );
}
