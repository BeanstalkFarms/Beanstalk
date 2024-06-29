import { ERC20Token } from '~/classes/Token';
import { SILO_WHITELIST, SILO_WHITELIST_DEPRECATED } from '~/constants/tokens';
import useTokenMap from '../chain/useTokenMap';

export default function useWhitelist() {
  return useTokenMap<ERC20Token>(SILO_WHITELIST);
}

export const useWhitelistDeprecated = () =>
  useTokenMap<ERC20Token>(SILO_WHITELIST_DEPRECATED);

export const useIsTokenDeprecated = () => {
  const deprecatedTokens = useWhitelistDeprecated();

  return (address: string): boolean =>
    Object.values(deprecatedTokens).findIndex((t) => t.address === address) >=
    0;
};
