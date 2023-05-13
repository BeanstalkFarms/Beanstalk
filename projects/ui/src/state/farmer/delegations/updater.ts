import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { DateTime } from 'luxon';
import BigNumber from 'bignumber.js';
import { GovSpace, SNAPSHOT_SPACES } from '~/lib/Beanstalk/Governance';
import {
  useBeaNftUsersLazyQuery,
  useDelegatorsStalkLazyQuery,
  useVoterDelegatesLazyQuery,
  useVoterDelegatorsLazyQuery,
} from '~/generated/graphql';
import useAccount from '~/hooks/ledger/useAccount';
import { FarmerDelegation, GovSpaceAddressMap } from '.';
import {
  setDelegatorsVotingPower,
  setFarmerDelegates,
  setFarmerDelegators,
} from './actions';
import { useDelegatesRegistryContract } from '~/hooks/ledger/useContract';
import { GOV_SPACE_BY_ID, IS_DEV, tokenResult } from '~/util';
import { STALK } from '~/constants/tokens';
import { useAppSelector } from '~/state';
import { AddressMap, ZERO_ADDRESS } from '~/constants';
import { getDefaultGovSpaceMap } from './reducer';

export function useReadDelegatesDev() {
  const account = useAccount();
  const registry = useDelegatesRegistryContract();

  const dispatch = useDispatch();

  const fetch = useCallback(
    async (_account?: string) => {
      const address = (_account || account)?.toLowerCase();
      if (!address) return;
      const spaces = Object.entries(GOV_SPACE_BY_ID);

      const result = await Promise.all(
        spaces.map(async ([space, id]) => {
          const response = await registry.delegation(address, id);
          const data =
            response === ZERO_ADDRESS
              ? undefined
              : {
                  address: response,
                  timestamp: DateTime.now().set({ year: 2000 }),
                  votes: {},
                };
          return {
            [space]: data,
          };
        })
      );
      const mapped = result.reduce((prev, curr) => ({ ...prev, ...curr }), {});

      console.debug('[useReadDelegatesDev] RESULT = ', mapped);

      dispatch(setFarmerDelegates(mapped));
      return mapped;
    },
    [dispatch, account, registry]
  );

  return [fetch] as const;
}

/**
 * Fetch accounts that this farmer has delegated their voting power to
 */
export function useFetchFarmerDelegates() {
  const account = useAccount();

  const dispatch = useDispatch();

  const [readDelegatesDev] = useReadDelegatesDev();
  const [fetchDelegates] = useVoterDelegatesLazyQuery({
    fetchPolicy: 'cache-and-network',
    context: { subgraph: 'snapshot-labs' },
  });

  const fetch = useCallback(
    async (_account?: string, options?: { dispatch?: boolean }) => {
      try {
        if (IS_DEV) return readDelegatesDev(_account);
        const address = _account || account;
        const shouldDispatch = options?.dispatch ?? true;
        if (!address) return undefined;

        const queryData = await fetchDelegates({
          variables: {
            space_in: SNAPSHOT_SPACES,
            voter_address: address,
          },
        });

        const delegations = queryData?.data?.delegations || [];
        const result = delegations.reduce<FarmerDelegation['delegates']>(
          (prev, curr) => ({
            ...prev,
            [curr.space as GovSpace]: {
              address: curr.delegate,
              timestamp: DateTime.fromSeconds(curr.timestamp),
              votes: {},
            },
          }),
          {}
        );

        console.debug('[farmer/delegations/fetchDelegates] RESULT =', result);

        shouldDispatch && dispatch(setFarmerDelegates(result));
        return result;
      } catch (e) {
        console.debug('[useFarmerDelegations/fetchDelegates] FAILED:', e);
        return undefined;
      }
    },
    [account, dispatch, fetchDelegates, readDelegatesDev]
  );

  const clear = useCallback(() => {
    dispatch(setFarmerDelegates({}));
  }, [dispatch]);

  return [fetch, clear] as const;
}

/**
 * Fetch accounts who have delegated their votes to this Farmer
 */
export function useFetchFarmerDelegators() {
  const account = useAccount();

  const dispatch = useDispatch();

  const [fetchDelegators] = useVoterDelegatorsLazyQuery({
    fetchPolicy: 'cache-and-network',
    context: { subgraph: 'snapshot-labs' },
  });

  const fetch = useCallback(
    async (_account?: string, options?: { dispatch: boolean }) => {
      const address = _account || account;
      const shouldDispatch = options?.dispatch ?? true;
      if (!address) return undefined;

      try {
        const queryData = await fetchDelegators({
          variables: {
            space_in: SNAPSHOT_SPACES,
            voter_address: address,
          },
        });
        const d = queryData.data?.delegations || [];
        const result = d.reduce<FarmerDelegation['delegators']['users']>(
          (prev, curr) => {
            const spaceDelegators = prev[curr.space as GovSpace] || {};
            const currDelegator = {
              address: curr.delegator,
              timestamp: DateTime.fromSeconds(curr.timestamp),
            };
            return {
              ...prev,
              [curr.space]: {
                ...spaceDelegators,
                [currDelegator.address]: currDelegator,
              },
            };
          },
          {}
        );

        console.debug('[farmer/delegations/fetchDelegators] RESULT = ', result);

        shouldDispatch && dispatch(setFarmerDelegators(result));
        return result;
      } catch (e) {
        console.debug('[useFarmerDelegations/fetchDelegators] FAILED:', e);
        return undefined;
      }
    },
    [account, dispatch, fetchDelegators]
  );

  const clear = useCallback(() => {
    dispatch(setFarmerDelegators({}));
  }, [dispatch]);

  return [fetch, clear] as const;
}

export function useFetchNFTVotingPower() {
  const farmerDelegators = useAppSelector(
    (state) => state._farmer.delegations.delegators.users
  );

  const account = useAccount();

  const dispatch = useDispatch();

  const delegators = useMemo(() => {
    if (!account) return [];
    const bySpace = farmerDelegators[GovSpace.BeanNFT] || {};
    const addresses = Object.keys(bySpace).map((a) => a.toLowerCase());
    return [...new Set(addresses)];
  }, [account, farmerDelegators]);

  const [triggerQuery] = useBeaNftUsersLazyQuery({
    variables: { id_in: delegators },
    fetchPolicy: 'cache-and-network',
    context: { subgraph: 'beanft' },
  });

  /// handlers
  const fetch = useCallback(async () => {
    try {
      if (!account || !delegators.length) return;
      const data = await triggerQuery();
      const byUser = data.data?.beaNFTUsers || [];
      const votingPower = byUser.reduce<AddressMap<BigNumber>>((acc, curr) => {
        const genesis = curr.genesis?.length || 0;
        const winter = curr.winter?.length || 0;
        const barnRaise = curr.barnRaise?.length || 0;
        acc[curr.id] = new BigNumber(genesis + winter + barnRaise);
        return acc;
      }, {});

      dispatch(
        setDelegatorsVotingPower({
          space: GovSpace.BeanNFT,
          data: votingPower,
        })
      );

      console.debug(
        '[farmer/delegations/useFetchNFTVotingPower] RESULT = ',
        votingPower
      );

      return votingPower;
    } catch (err) {
      console.debug('[farmer/delegations/useFetchNFTVotingPower] FAILED:', err);
      return undefined;
    }
  }, [account, delegators, dispatch, triggerQuery]);

  const clear = useCallback(() => {
    dispatch(
      setDelegatorsVotingPower({
        space: GovSpace.BeanNFT,
        data: {},
      })
    );
  }, [dispatch]);

  return [fetch, clear] as const;
}

export function useFetchStalkVotingPower() {
  const farmerDelegators = useAppSelector(
    (state) => state._farmer.delegations.delegators.users
  );

  const account = useAccount();

  const dispatch = useDispatch();

  const delegators = useMemo(() => {
    if (!farmerDelegators) return [];

    const _delegators = Object.entries(farmerDelegators);
    const accounts = _delegators.reduce<string[]>((prev, curr) => {
      const [space, _users] = curr;
      if (space === GovSpace.BeanNFT) return prev;

      const users = Object.values(_users);
      const addresses = users.map((u) => u.address.toLowerCase());

      return [...prev, ...addresses];
    }, []);

    return [...new Set(accounts)];
  }, [farmerDelegators]);

  const [triggerQuery] = useDelegatorsStalkLazyQuery({
    variables: { ids: delegators },
    fetchPolicy: 'cache-and-network',
    context: { subgraph: 'beanstalk' },
  });

  const fetch = useCallback(async () => {
    try {
      if (!account || !delegators.length) return;
      const data = await triggerQuery();
      const farmers = data.data?.farmers || [];

      const byFarmer = farmers.reduce<AddressMap<BigNumber>>((acc, curr) => {
        const result = tokenResult(STALK)(curr.silo?.stalk || 0);
        acc[curr.id.toLowerCase()] = result;
        return acc;
      }, {});

      const votingPower =
        getDefaultGovSpaceMap() as GovSpaceAddressMap<BigNumber>;

      const _delegators = Object.entries(farmerDelegators);

      _delegators.forEach(([_space, _users]) => {
        const space = _space as GovSpace;
        if (space === GovSpace.BeanNFT) return;

        Object.keys(_users).forEach((address) => {
          const vp = byFarmer[address.toLowerCase()];
          if (vp) {
            votingPower[space][address] = vp;
          }
        });
      });

      Object.entries(votingPower).forEach(([_space, _data]) => {
        if (_space !== GovSpace.BeanNFT) {
          dispatch(
            setDelegatorsVotingPower({
              space: _space as GovSpace,
              data: _data,
            })
          );
        }
      });

      console.debug(
        '[farmer/delegations/useFetchStalkVotingPower] Result = ',
        votingPower
      );

      return votingPower;
    } catch (err) {
      console.debug(
        '[farmer/delegations/useFetchStalkVotingPower] FAILED:',
        err
      );
      return undefined;
    }
  }, [account, delegators.length, triggerQuery, farmerDelegators, dispatch]);

  const clear = useCallback(() => {
    [
      GovSpace.BeanSprout,
      GovSpace.BeanstalkDAO,
      GovSpace.BeanstalkFarms,
    ].forEach((space) => {
      dispatch(
        setDelegatorsVotingPower({
          space,
          data: {},
        })
      );
    });
  }, [dispatch]);

  return [fetch, clear] as const;
}

export default function FarmerDelegationsUpdater() {
  const farmerDelegators = useAppSelector(
    (s) => s._farmer.delegations.delegators
  );
  const account = useAccount();

  const [fetchDelegates, clearDelegates] = useFetchFarmerDelegates();
  const [fetchDelgators, clearDelegators] = useFetchFarmerDelegators();
  const [fetchNFTVP, clearNFTVP] = useFetchNFTVotingPower();
  const [fetchStalkVP, clearStalkVP] = useFetchStalkVotingPower();

  const delegatorsLen = Object.keys(farmerDelegators.users).length;
  const delegatorsVPLen = Object.keys(farmerDelegators.votingPower).length;

  const fetchVP = useMemo(() => {
    if (!account) return false;
    return delegatorsLen !== delegatorsVPLen;
  }, [account, delegatorsLen, delegatorsVPLen]);

  /// Fetch delegations and delegators
  useEffect(() => {
    if (account) {
      fetchDelegates();
      fetchDelgators();
    }
  }, [account, fetchDelegates, fetchDelgators]);

  /// Fetch Voting Power
  useEffect(() => {
    if (fetchVP) {
      fetchNFTVP();
      fetchStalkVP();
    }
  }, [fetchVP, fetchNFTVP, fetchStalkVP]);

  /// Clear on account change / disconnect
  useEffect(() => {
    if (!account) {
      clearDelegates();
      clearDelegators();
      clearNFTVP();
      clearStalkVP();
    }
  }, [account, clearDelegates, clearDelegators, clearNFTVP, clearStalkVP]);

  return null;
}
