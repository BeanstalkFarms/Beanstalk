import { useCallback, useEffect, useRef } from 'react';

const useTimedRefresh = (
  handler: () => any,
  intervalMs : number,
  enabled : boolean = true,
  enabledBackground: boolean = false,
) => {
  const interval = useRef<ReturnType<typeof setInterval>>();

  /// Start running the handler every `intervalMs` millis
  const start = useCallback(() => {
    handler();
    interval.current = setInterval(() => {
      handler();
    }, intervalMs);
    return () => clearInterval(interval.current);
  }, [handler, intervalMs]);

  /// Window event handlers
  const onFocus = useCallback(() => {
    if (enabled) start();
  }, [enabled, start]);
  const onBlur = useCallback(() => {
    if (interval.current && enabledBackground === false) clearInterval(interval.current);
  }, [interval, enabledBackground]);

  /// Setup interval on initial load or params change
  useEffect(() => {
    if (interval) clearInterval(interval.current);
    if (enabled) {
      const cancel = start();
      return () => cancel();
    }
  }, [enabled, interval, start]);

  /// Clear interval on blur; re-run on focus
  useEffect(() => {
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [onBlur, onFocus]);
};

export default useTimedRefresh;
