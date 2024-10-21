import { ERC20Token as LegacyERC20Token } from '~/classes/Token';
import { SILO_WHITELIST } from '~/constants/tokens';
import useTokenMap from '../chain/useTokenMap';

/**
 * @deprecated
 */
export default function useWhitelist() {
  return useTokenMap<LegacyERC20Token>(SILO_WHITELIST);
}
