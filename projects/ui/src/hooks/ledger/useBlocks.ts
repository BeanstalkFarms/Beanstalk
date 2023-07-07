import { Blocks } from '@beanstalk/sdk';
import useChainConstant from '../chain/useChainConstant';

export default function useBlocks() {
  return useChainConstant(Blocks);
}
