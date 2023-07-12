import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import debounce from 'lodash/debounce';
import toast from 'react-hot-toast';

export type QuoteHandler = () => Promise<any>;

export type QuoteSettings = {
  /** The number of milliseconds to wait before calling */
  debounceMs: number;
};

const baseSettings = {
  debounceMs: 250,
  onReset: () => null,
};

export default function useQuoteAgnostic<T extends any>(
  quoteHandler: () => Promise<T>,
  _settings?: Partial<QuoteSettings>
): [result: T | null, quoting: boolean, getQuote: () => void] {
  const [result, setResult] = useState<T | null>(null);
  const [quoting, setQuoting] = useState<boolean>(false);

  const settings = useMemo(
    () => ({ ...baseSettings, ..._settings }),
    [_settings]
  );
  const abortController = useRef<null | AbortController>(null);

  /// When token changes, reset the amount.
  useEffect(() => {
    setQuoting(false);
  }, [settings]);

  const __getQuote = useCallback(() => {
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
      quoteHandler()
        .then((_result) => {
          /// This line is crucial: it ignores the request if it was cancelled in-flight.
          if (abortController.current?.signal.aborted) return reject();
          if (_result === null) return resolve(_result);
          /// FIXME: this is for backwards-compat, find everywhere that doesnt use the obj form.
          setResult(_result);
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
  }, [setQuoting, setResult, quoteHandler, abortController]);

  /// Debounced function is pulled out of the useCallback method
  /// to (a) allow React to calculate the right dependency array,
  /// and (b) to let us easily use the cancel() method below.
  const _getQuote = useMemo(
    () => debounce(__getQuote, settings.debounceMs, { trailing: true }),
    [__getQuote, settings.debounceMs]
  );

  // Handler to refresh
  const getQuote = useCallback(() => {
    abortController.current?.abort(); // cancel promise if it's already in flight
    _getQuote.cancel(); // cancel handler if it's currently pending being called by the debouncer

    setQuoting(true);
    _getQuote();
  }, [_getQuote, setQuoting, abortController]);

  return [result, quoting, getQuote];
}
