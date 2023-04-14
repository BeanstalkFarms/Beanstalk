import { BEAN } from '~/constants/tokens';
import { useAllPodListingsQuery } from '~/generated/graphql';
import useHarvestableIndex from '~/hooks/beanstalk/useHarvestableIndex';
import useChainConstant from '~/hooks/chain/useChainConstant';

type BaseOptions = Parameters<typeof useAllPodListingsQuery>[0]

export default function usePodListings(
  baseOptions: (
    Omit<BaseOptions, 'variables'>
    & { variables: Partial<BaseOptions['variables']> }
  )
) {
  const harvestableIndex = useHarvestableIndex();
  const Bean = useChainConstant(BEAN);
  return useAllPodListingsQuery({
    ...baseOptions,
    variables: {
      maxHarvestableIndex: Bean.stringify(harvestableIndex),
      ...baseOptions?.variables,
    },
    /// Skip when harvestableIndex isn't loaded
    skip: baseOptions?.skip ? baseOptions.skip : !(harvestableIndex?.gt(0))
  });
}
