import ALL_POOLS, { WHITELISTED_POOLS } from '~/constants/pools';
import useChainConstant from '../chain/useChainConstant';

export default function usePools(showAll: boolean = true) {
  return useChainConstant(showAll ? ALL_POOLS : WHITELISTED_POOLS);
}
