import { ERC20Token } from '~/classes/Token';
import { SILO_WHITELIST } from '~/constants/tokens';
import useTokenMap from '../chain/useTokenMap';

export default function useWhitelist() {
  return useTokenMap<ERC20Token>(SILO_WHITELIST);
}
