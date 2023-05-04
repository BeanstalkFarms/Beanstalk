import { ERC20Token, NativeToken, StepGenerator } from '@beanstalk/sdk';
import { BigNumber } from 'bignumber.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import debounce from 'lodash/debounce';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';

export type QuoteHandlerResultNew = {
  amountOut: BigNumber;
  value?: ethers.BigNumber;
  steps?: StepGenerator[];
};

export type QuoteHandlerWithParams<T = {}> = (
  tokenIn: ERC20Token | NativeToken,
  amountIn: BigNumber,
  /** Calculate `amountOut` of this `tokenOut`. */
  tokenOut: ERC20Token | NativeToken,
  ...parameters: T[]
) => Promise<null | QuoteHandlerResultNew['amountOut'] | QuoteHandlerResultNew>;

export type QuoteSettingsNew = {
  /** The number of milliseconds to wait before calling */
  debounceMs : number;
  /** If true, returns amountOut = amountIn when tokenOut = tokenIn. Otherwise returns void. */
  ignoreSameToken : boolean;
  /** */
  onReset: () => QuoteHandlerResultNew | null;
}

const baseSettings = {
  debounceMs: 250,
  ignoreSameToken: true,
  onReset: () => null,
};

/**
 * NOTE: 
 *  - this is essentially the same thing as useQuote but configured to use with tokens from the SDK
 *  - It also accepts one additional generic parameter. 
 * 
 * @param tokenOut 
 * @param quoteHandler A function that returns a quoted amountOut value.
 * @param _settings 
 * @returns 
 */
export default function useQuoteWithParams<T>(
  tokenOut: ERC20Token | NativeToken,
  quoteHandler: QuoteHandlerWithParams<T>,
  _settings?: Partial<QuoteSettingsNew>,
) : [
  result: QuoteHandlerResultNew | null,
  quoting: boolean,
  refreshAmountOut: (_tokenIn: ERC20Token | NativeToken, _amountIn: BigNumber, params: T) => void,
] {
  const [result, setResult]   = useState<QuoteHandlerResultNew | null>(null);
  const [quoting, setQuoting] = useState<boolean>(false);
  const settings              = useMemo(() => ({ ...baseSettings, ..._settings }), [_settings]);
  const abortController       = useRef<null | AbortController>(null);
  
  /// When token changes, reset the amount.
  useEffect(() => {
    setResult(settings.onReset());
    setQuoting(false);
  }, [tokenOut, settings]);

  const __getAmountOut = useCallback((
    tokenIn: ERC20Token | NativeToken,
    amountIn: BigNumber,
    params: T,
  ) => {
    /// If a quote request is currently in flight, cancel it.
    if (abortController.current) abortController.current.abort();
    /// Set up a new abort controller for this request only.
    abortController.current = new AbortController();
    return new Promise((resolve, reject) => {
      /// Listen for an abort event.
      abortController.current?.signal.addEventListener('abort', () => {
        setResult(null);
        setQuoting(false);
        reject();
      });
      // NOTE: quoteHandler should parse amountOut to the necessary decimals
      quoteHandler(tokenIn, amountIn, tokenOut, params)
        .then((_result) => {
          /// This line is crucial: it ignores the request if it was cancelled in-flight.
          if (abortController.current?.signal.aborted) return reject();
          if (_result === null) return resolve(_result);
          /// FIXME: this is for backwards-compat, find everywhere that doesnt use the obj form.
          setResult(_result instanceof BigNumber ? { amountOut: _result } : _result);
          /// Return the result back to wherever it was called.
          setQuoting(false);
          resolve(_result);
        })
        .catch((e) => {
          console.error(e);
          toast.error(e.toString());
          setQuoting(false);
          reject(e);
        })
        .finally(() => {
          /// After every invocation, clear the abort controller.
          abortController.current = null;
          /// Moved the `setQuoting` call to the above blocks because
          /// we don't want to set the loading state to false if another
          /// request is about to be in flight behind this one.
        });
    });
  }, [
    tokenOut,
    setQuoting,
    setResult,
    quoteHandler,
    abortController,
  ]);

  /// Debounced function is pulled out of the useCallback method
  /// to (a) allow React to calculate the right dependency array,
  /// and (b) to let us easily use the cancel() method below.
  const _getAmountOut = useMemo(
    () => debounce(__getAmountOut, settings.debounceMs, { trailing: true }),
    [__getAmountOut, settings.debounceMs]
  );

  // Handler to refresh
  const getAmountOut = useCallback((tokenIn: ERC20Token | NativeToken, amountIn: BigNumber, params: T) => {
    if (tokenIn === tokenOut) {
      if (settings.ignoreSameToken) return;
      setQuoting(true);
      _getAmountOut(tokenIn, amountIn, params);
    }
    abortController.current?.abort(); // cancel promise if it's already in flight
    _getAmountOut.cancel();           // cancel handler if it's currently pending being called by the debouncer
    if (amountIn.lte(0)) {
      setResult(null);
      setQuoting(false);
    } else {
      setQuoting(true);
      _getAmountOut(tokenIn, amountIn, params);
    }
  }, [
    tokenOut,
    settings.ignoreSameToken,
    _getAmountOut,
    setResult,
    setQuoting,
    abortController,
  ]);

  return [result, quoting, getAmountOut];
}
