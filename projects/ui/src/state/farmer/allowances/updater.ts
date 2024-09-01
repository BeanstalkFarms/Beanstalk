import { TokenInstance, useGetLegacyToken } from '~/hooks/beanstalk/useTokens';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { isSdkToken, toTokenUnitsBN } from '~/util';
import { getAccount } from '~/util/Account';
import { ContractFunctionParameters, erc20Abi } from 'viem';
import { multicall } from '@wagmi/core';
import { config } from '~/util/wagmi/config';
import BigNumber from 'bignumber.js';
import { exists } from '~/util/UI';
import useChainState from '~/hooks/chain/useChainState';
import { clearAllowances, updateAllowances } from './actions';

export function useFetchFarmerAllowances() {
  const dispatch = useDispatch();
  const getLegacyToken = useGetLegacyToken();
  const { isEthereum } = useChainState();

  const fetch = useCallback(
    (
      _account: string,
      _contract: string,
      _tokens: TokenInstance | TokenInstance[]
    ) => {
      if (isEthereum) return;
      const account = getAccount(_account);
      if (_contract && account) {
        console.debug(
          `[farmer/allowances/useFetchAllowances] FETCH account = ${account} contract = ${_contract} token(s) = ${_tokens.toString()}`
        );

        const tokens = Array.isArray(_tokens) ? _tokens : [_tokens];

        return Promise.all([
          multicall(config, {
            contracts: buildMultiCall(tokens, account, _contract),
          }).then((results) => {
            const tokenAllowances = tokens.map((tk, i) => {
              let allowance: BigNumber;
              const result = extractResult(results[i], 0n);
              if (isSdkToken(tk)) {
                allowance = new BigNumber(tk.fromBlockchain(result).toHuman());
              } else {
                allowance = toTokenUnitsBN(result.toString(), tk.decimals);
              }
              if (!exists(allowance)) {
                throw new Error(`allowance is undefined for ${tk.symbol}`);
              }

              return {
                token: getLegacyToken(tk),
                contract: _contract,
                allowance: allowance,
              };
            });

            console.debug(
              `[farmer/allowances/useFetchAllowances] RESULT: ${tokenAllowances.length} allowances`,
              tokenAllowances
            );
            dispatch(updateAllowances(tokenAllowances));
          }),
        ]);
      }
      return Promise.resolve();
    },
    [dispatch, getLegacyToken, isEthereum]
  );

  const clear = useCallback(() => {
    console.debug('[farmer/allowances/useFetchAllowances] CLEAR');
    dispatch(clearAllowances());
  }, [dispatch]);

  return [fetch, clear] as const;
}

function buildMultiCall(
  tokens: TokenInstance[],
  account: string,
  contract: string
) {
  return tokens.map<ContractFunctionParameters>((token) => ({
    address: token.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [account as `0x${string}`, contract as `0x${string}`],
  }));
}

type CallResult = Awaited<
  ReturnType<typeof multicall<typeof config, ContractFunctionParameters[]>>
>[number];

function extractResult(result: CallResult, defaultValue: bigint): bigint {
  if (result.error) return defaultValue;
  return result.result as bigint;
}
