import { useEffect, useRef, useState } from "react";

/**
 * Purpose of this hook is to prevent loading indicators
 * from flashing due to fast load times
 */
export const useLagLoading = (_loading: boolean, _lagTime?: number) => {
  const mountTime = useRef<number | null>(Date.now());
  const [loading, setDataLoading] = useState(_loading);

  const lagTime = _lagTime || 500;

  useEffect(() => {
    if (!_loading) return;

    if (mountTime.current) {
      const now = Date.now();
      const diff = Math.abs(mountTime.current - now);

      const run = async () => {
        if (diff > lagTime) {
          setDataLoading(false);
        } else {
          const remaining = lagTime - diff;
          setTimeout(() => {
            setDataLoading(false);
          }, remaining);
        }
      };

      run();
    }

    return () => {
      mountTime.current = null;
    };
  }, [loading, _loading, mountTime, lagTime]);

  return loading;
};
