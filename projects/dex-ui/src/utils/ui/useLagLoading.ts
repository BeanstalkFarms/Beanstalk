import { useEffect, useRef, useState } from "react";

/**
 * Purpose of this hook is to prevent loading indicators
 * from flashing due to fast load times
 */

export const useLagLoading = (_loading: boolean, _lagTime?: number) => {
  const mountTime = useRef(Date.now());
  const [loading, setDataLoading] = useState(true);

  const lagTime = _lagTime || 300;

  useEffect(() => {
    if (_loading || !loading) return;

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
  }, [loading, _loading, mountTime, lagTime]);

  return loading;
};
