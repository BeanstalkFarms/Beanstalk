import BigNumber from 'bignumber.js';
import { useCallback, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import Token, { NativeToken } from '~/classes/Token';
import { MAX_UINT256 } from '~/constants';
import useAccount from '~/hooks/ledger/useAccount';
import { AppState } from '~/state';
import { useFetchFarmerAllowances } from '~/state/farmer/allowances/updater';

/**
 * @param contractAddress The contract that needs approval.
 * @param tokens Tokens 
 * @param config 
 * @returns 
 */
export default function useAllowances(
  contractAddress: string | undefined,
  tokens: Token[],
  config: { loadIfAbsent: boolean } = {
    loadIfAbsent: true
  }
) {
  const allowances = useSelector<AppState, AppState['_farmer']['allowances']>((state) => state._farmer.allowances);
  const account = useAccount();
  const [fetchAllowances] = useFetchFarmerAllowances();

  // If a provided Token is a NativeToken, there is no allowance.
  // Otherwise, see if we've loaded an approval for this contract + token combo.
  const currentAllowances : (null | BigNumber)[] = useMemo(() => tokens.map((curr) => {
    if (curr instanceof NativeToken) return new BigNumber(MAX_UINT256);
    if (!contractAddress) return null;
    return allowances[contractAddress]
      ? (allowances[contractAddress][curr.address] || null)
      : null;
  }), [
    tokens,
    allowances,
    contractAddress
  ]);

  // If requested, the component will automatically load any
  // allowances that aren't present in state.
  useEffect(() => {
    if (config.loadIfAbsent && account && contractAddress) {
      // Reduce `results` to a list of the corresponding `tokens`,
      // filtering only for absent results.
      const absent = currentAllowances.reduce<Token[]>((prev, curr, index) => {
        if (!curr) prev.push(tokens[index]);
        return prev;
      }, [] as Token[]);
      // console.debug(`[hooks/useAllowance] found ${absent.length} absent tokens for ${contractAddress}`);
      if (absent.length > 0) {
        fetchAllowances(
          account,
          contractAddress,
          absent
        );
      }
    }
  }, [
    account,
    contractAddress,
    config.loadIfAbsent,
    currentAllowances,
    tokens,
    fetchAllowances,
  ]);

  // Allow a component to refetch initial allowances,
  // or to specify new ones to grab.
  const refetch = useCallback((_tokens?: Token[]) => {
    if (account && contractAddress) {
      return fetchAllowances(
        account,
        contractAddress,
        _tokens || tokens
      );
    }
    return Promise.resolve();
  }, [fetchAllowances, account, tokens, contractAddress]);

  return [currentAllowances, refetch] as const;
}
