import { ERC20Token as LegacyERC20Token } from '~/classes/Token';
import { SILO_WHITELIST, SILO_WHITELIST_DEPRECATED } from '~/constants/tokens';
import { ERC20Token } from '@beanstalk/sdk';
import useTokenMap from '../chain/useTokenMap';
import useSdk from '../sdk';

/**
 * @deprecated
 */
export default function useWhitelist() {
  return useTokenMap<LegacyERC20Token>(SILO_WHITELIST);
}

export function useSdkWhitelist() {
  const sdk = useSdk();
  return useTokenMap<ERC20Token>(sdk.tokens.siloWhitelist as Set<ERC20Token>);
}

export const useWhitelistDeprecated = () =>
  useTokenMap<LegacyERC20Token>(SILO_WHITELIST_DEPRECATED);

export const useIsTokenDeprecated = () => {
  const deprecatedTokens = useWhitelistDeprecated();

  return (address: string): boolean =>
    Object.values(deprecatedTokens).findIndex((t) => t.address === address) >=
    0;
};
