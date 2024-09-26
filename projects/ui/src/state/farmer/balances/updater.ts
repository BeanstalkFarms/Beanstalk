import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import flatMap from 'lodash/flatMap';
import { ZERO_BN } from '~/constants';
import { tokenResult } from '~/util';
import useAccount from '~/hooks/ledger/useAccount';
import { useTokens } from '~/hooks/beanstalk/useTokens';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useChainState from '~/hooks/chain/useChainState';
import useL2OnlyEffect from '~/hooks/chain/useL2OnlyEffect';
import { clearBalances, updateBalances } from './actions';

export const useFetchFarmerBalances = () => {
  /// State
  const beanstalk = useBeanstalkContract();
  const { erc20TokenMap, ETH: Eth } = useTokens();
  const { isEthereum } = useChainState();
  const account = useAccount();

  const dispatch = useDispatch();

  /// Handlers
  /// FIXME: make this callback accept a tokens array to prevent reloading all balances on every call
  /// FIXME: multicall
  const fetch = useCallback(async () => {
    if (isEthereum) return;
    try {
      if (account && erc20TokenMap) {
        const erc20Addresses = Object.keys(erc20TokenMap);
        console.debug('Token Addresses', erc20Addresses);
        const promises = Promise.all([
          // ETH cannot have an internal balance and isn't returned
          // from the standard getAllBalances call.
          // multiCall.getEthBalance(account)
          Eth.getBalance(account)
            .then(tokenResult(Eth))
            .then((result) => ({
              token: Eth,
              balance: {
                internal: ZERO_BN,
                external: result,
                total: result,
              },
            })),
          beanstalk
            .getAllBalances(account, erc20Addresses)
            .then((result) => {
              console.debug(
                '[farmer/balances/updater]: getAllBalances = ',
                result
              );
              return result;
            })
            .then((result) =>
              result.map((struct, index) => {
                const _token = erc20TokenMap[erc20Addresses[index]];
                const _tokenResult = tokenResult(_token);
                return {
                  token: _token,
                  balance: {
                    internal: _tokenResult(struct.internalBalance),
                    external: _tokenResult(struct.externalBalance),
                    total: _tokenResult(struct.totalBalance),
                  },
                };
              })
            ),
        ]).then((results) => flatMap(results));

        console.debug(
          `[farmer/updater/useFetchBalances] FETCH: balances (account = ${account})`
        );
        const balances = await promises;

        console.debug('[farmer/updater/useFetchBalances] RESULT: ', balances);

        const localBalances = balances.reduce(
          (obj, elem) =>
            Object.assign(obj, { [elem.token.address]: elem.balance }),
          {}
        );
        localStorage.setItem('farmerBalances', JSON.stringify(localBalances));

        dispatch(updateBalances(balances));
        return promises;
      }
    } catch (e) {
      console.debug('[farmer/updater/useFetchBalances] FAILED', e);
      console.error(e);
    }
  }, [dispatch, beanstalk, Eth, erc20TokenMap, account, isEthereum]);

  const clear = useCallback(() => {
    dispatch(clearBalances());
  }, [dispatch]);

  return [fetch, clear] as const;
};

const FarmerBalancesUpdater = () => {
  const [fetch, clear] = useFetchFarmerBalances();
  const account = useAccount();

  useL2OnlyEffect(() => {
    clear();
    if (account) fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  return null;
};

export default FarmerBalancesUpdater;
