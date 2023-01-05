import { useMemo } from 'react';
import { usePodListingQuery } from '~/generated/graphql';
import { Source } from '~/util';
import { castPodListing } from '~/state/farmer/market';
import useFarmerListingsLedger from '../farmer/useFarmerListingsLedger';
import useHarvestableIndex from '~/hooks/beanstalk/useHarvestableIndex';

const usePodListing = (index: string | undefined) => {
  const farmerListings = useFarmerListingsLedger();
  const query          = usePodListingQuery({ variables: { index: index || '' }, skip: !index });
  const harvestableIndex = useHarvestableIndex();
  const [data, source] = useMemo(() => {
    if (index && query.data?.podListings?.[0]) {
      return [castPodListing(query.data.podListings[0], harvestableIndex), Source.SUBGRAPH];
    }
    if (index && farmerListings[index]) {
      return [farmerListings[index], Source.LOCAL];
    }
    return [undefined, undefined];
  }, [farmerListings, harvestableIndex, index, query.data?.podListings]);
  
  return {
    ...query,
    /// If the query finished loading and has no data,
    /// check redux for a local order that was loaded
    /// via direct event processing.
    data,
    source,
  };
};

export default usePodListing;
