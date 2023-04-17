import { useMemo } from 'react';
import { usePodOrderQuery } from '~/generated/graphql';
import { Source } from '~/util';
import { castPodOrder } from '~/state/farmer/market';
import useFarmerOrdersLedger from '../farmer/useFarmerOrdersLedger';

const usePodOrder = (id: string | undefined) => {
  const farmerOrders   = useFarmerOrdersLedger();
  const query          = usePodOrderQuery({ variables: { id: id || '' }, skip: !id });
  const [data, source] = useMemo(() => {
    if (id && query.data?.podOrder) {
      return [castPodOrder(query.data.podOrder), Source.SUBGRAPH];
    }
    if (id && farmerOrders[id]) {
      return [farmerOrders[id], Source.LOCAL];
    }
    return [undefined, undefined];
  }, [farmerOrders, id, query.data?.podOrder]);
  
  return {
    ...query,
    /// If the query finished loading and has no data,
    /// check redux for a local order that was loaded
    /// via direct event processing.
    data,
    source,
  };
};

export default usePodOrder;
