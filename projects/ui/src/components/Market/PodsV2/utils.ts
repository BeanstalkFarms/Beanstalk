import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export const useMarketPageUrlParams = () => {
  const location = useLocation();

  const data = useMemo(() => {
    const [action, id] = location.pathname.split('/').slice(2, 4);
    if (['buy', 'sell'].includes(action.toLowerCase())) {
      return {
        listingID: action === 'buy' ? id : undefined,
        orderID: action === 'sell' ? id : undefined,
      };
    }
    return {
      listingID: undefined,
      orderID: undefined,
    };
  }, [location.pathname]);

  return data;
};
