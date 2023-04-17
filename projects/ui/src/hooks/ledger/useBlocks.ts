import { DEPLOYMENT_BLOCKS } from '~/constants/blocks';
import useChainConstant from '../chain/useChainConstant';

export default function useBlocks() {
  return useChainConstant(DEPLOYMENT_BLOCKS);
}
