import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { DateTime } from 'luxon';
import { GovSpace, SNAPSHOT_SPACES } from '~/lib/Beanstalk/Governance';
import {
  useDelegatorsStalkLazyQuery,
  useVoterDelegatesLazyQuery,
  useVoterDelegatorsLazyQuery,
} from '~/generated/graphql';
import useAccount from '~/hooks/ledger/useAccount';
import { FarmerDelegation } from '.';
import {
  setDelegatorsVotingPower,
  setFarmerDelegates,
  setFarmerDelegators,
} from './actions';
import { AppState } from '~/state';
import { useDelegatesRegistryContract } from '~/hooks/ledger/useContract';
import useFarmerDelegations from '~/hooks/farmer/useFarmerDelegations';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import { ZERO_BN } from '~/constants';
import { tokenResult } from '~/util';
import { STALK } from '~/constants/tokens';

export const GOV_SPACE_BY_ID: { [key in GovSpace]: string } = {
  [GovSpace.BeanstalkDAO]:
    '0x6265616e7374616c6b64616f2e65746800000000000000000000000000000000',
  [GovSpace.BeanstalkFarms]:
    '0x6265616e7374616c6b6661726d732e6574680000000000000000000000000000',
  [GovSpace.BeanSprout]:
    '0x77656172656265616e7370726f75742e65746800000000000000000000000000',
  [GovSpace.BeanNFT]:
    '0x6265616e66742e65746800000000000000000000000000000000000000000000',
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const IS_DEV = process.env.NODE_ENV !== 'production';

export function useReadDelegatesDev() {
  const account = useAccount();
  const registry = useDelegatesRegistryContract();

  const dispatch = useDispatch();

  const fetch = useCallback(async () => {
    if (!account) return;
    const spaces = Object.entries(GOV_SPACE_BY_ID);

    const result = await Promise.all(
      spaces.map(async ([space, id]) => {
        const response = await registry.delegation(account, id);
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
  }, [dispatch, account, registry]);

  return [fetch] as const;
}

export function useFetchFarmerDelegations() {
  const dispatch = useDispatch();

  const account = useAccount();
  const [fetchDelegatesDevOnly] = useReadDelegatesDev();

  const [fetchDelegates] = useVoterDelegatesLazyQuery({
    variables: {
      space_in: SNAPSHOT_SPACES,
      voter_address: account || '',
    },
    fetchPolicy: 'cache-and-network',
    context: { subgraph: 'snapshot-labs' },
  });

  const [fetchDelegators] = useVoterDelegatorsLazyQuery({
    variables: {
      space_in: SNAPSHOT_SPACES,
      voter_address: account || '',
    },
    fetchPolicy: 'cache-and-network',
    context: { subgraph: 'snapshot-labs' },
  });

  /// fetch address to which this farmer has delegated their voting power
  const fetchVoterDelegates = useCallback(
    async (_account: string) => {
      try {
        if (IS_DEV) {
          await fetchDelegatesDevOnly();
          return;
        }

        const { data } = await fetchDelegates();

        const delegate = data?.delegations?.reduce<
          FarmerDelegation['delegates']
        >((prev, curr) => {
          prev[curr.space as GovSpace] = {
            address: curr.delegate,
            timestamp: DateTime.fromSeconds(curr.timestamp),
            votes: {},
          };
          return prev;
        }, {});

        console.debug(
          '[useFarmerDelegations/fetchDelegates] RESULT = ',
          delegate
        );

        dispatch(setFarmerDelegates(delegate || {}));

        return delegate;
      } catch (e) {
        console.debug('[useFarmerDelegations/fetchDelegates] FAILED:', e);
        return undefined;
      }
    },
    [dispatch, fetchDelegates, fetchDelegatesDevOnly]
  );

  /// fetch addresses who have delegated their votes to an account
  const fetchVoterDelegators = useCallback(
    async (_account: string) => {
      try {
        const { data } = await fetchDelegators();

        const delegators = data?.delegations?.reduce<
          FarmerDelegation['delegators']
        >((prev, curr) => {
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
        }, {});

        console.debug(
          '[useFarmerDelegations/fetchDelegators] RESULT = ',
          delegators
        );

        dispatch(setFarmerDelegators(delegators || {}));

        return delegators;
      } catch (e) {
        console.debug('[useFarmerDelegations/fetchDelegators] FAILED:', e);
        return undefined;
      }
    },
    [dispatch, fetchDelegators]
  );

  return [fetchVoterDelegates, fetchVoterDelegators] as const;
}

export function useFetchVotingPower() {
  const delegations = useFarmerDelegations();
  const farmerSilo = useFarmerSilo();
  const dispatch = useDispatch();

  const allStalkDelegators = useMemo(() => {
    const accounts = new Set<string>();
    Object.entries(delegations.delegators).forEach(([_space, _delegators]) => {
      const space = _space as GovSpace;
      if (space !== GovSpace.BeanNFT) {
        Object.entries(_delegators).forEach(([address]) => {
          accounts.add(address);
        });
      }
    });

    return Array.from(accounts);
  }, [delegations.delegators]);

  // const allNFTDelegators = useMemo(() => {
  //   const accounts = new Set<string>();
  //   const delegators = delegations.delegators[GovSpace.BeanNFT] || {};
  //   Object.values(delegators).forEach((delegator) => {
  //     accounts.add(delegator.address);
  //   });
  //   return Array.from(accounts);
  // }, [delegations.delegators]);

  const [fetchDelegatorsStalk] = useDelegatorsStalkLazyQuery({
    variables: {
      ids: allStalkDelegators.map((id) => id.toLowerCase()),
    },
    fetchPolicy: 'cache-and-network',
    context: { subgraph: 'beanstalk' },
  });

  const handleFetch = useCallback(async () => {
    try {
      if (!allStalkDelegators.length) return;
      const { data } = await fetchDelegatorsStalk();
      // console.log("result: ", data);
      const farmers = data?.farmers;

      const delegators = { ...delegations.delegators };

      const _votingPower = {
        [GovSpace.BeanSprout]: farmerSilo.stalk.active,
        [GovSpace.BeanstalkFarms]: farmerSilo.stalk.active,
        [GovSpace.BeanstalkDAO]: farmerSilo.stalk.active,
        [GovSpace.BeanNFT]: ZERO_BN, // FIX ME
      };

      farmers?.forEach((farmer) => {
        const _stalk = farmer.silo?.stalk;
        const stalk = _stalk ? tokenResult(STALK)(_stalk) : ZERO_BN;

        SNAPSHOT_SPACES.forEach((space) => {
          if (space === GovSpace.BeanNFT) return;
          const _delegators = delegators[space] || {};
          if (farmer.id in _delegators) {
            const amount = _votingPower[space] || ZERO_BN;
            _votingPower[space] = amount.plus(stalk);
          }
        });
      });

      Object.entries(_votingPower).forEach(([space, amount]) => {
        dispatch(
          setDelegatorsVotingPower({
            space: space as GovSpace,
            votingPower: amount,
          })
        );
      });

      console.debug('[useFetchVotingPower] RESULT = ', _votingPower);

      return _votingPower;
    } catch (err) {
      console.debug('[useFetchVotingPower] FAILED:', err);
      return undefined;
    }
  }, [
    allStalkDelegators.length,
    delegations.delegators,
    farmerSilo.stalk.active,
    dispatch,
    fetchDelegatorsStalk,
  ]);

  useEffect(() => {
    if (!allStalkDelegators.length) return;
    handleFetch();
  }, [allStalkDelegators.length, farmerSilo.stalk, handleFetch]);

  return [handleFetch] as const;
}

export default function FarmerDelegationsUpdater() {
  const farmerDelegations = useSelector<
    AppState,
    AppState['_farmer']['delegations']
  >((state) => state._farmer.delegations);
  const account = useAccount();
  const [fetchDelegates, fetchDelegators] = useFetchFarmerDelegations();

  const fetchedDelegates = Boolean(farmerDelegations.updated.delegates);
  const fetchedDelegators = Boolean(farmerDelegations.updated.delegators);

  useEffect(() => {
    if (!account) return;
    (async () => {})();
    if (!fetchedDelegators) {
      fetchDelegators(account);
    }
    if (!fetchedDelegates) {
      fetchDelegates(account);
    }
  }, [
    account,
    fetchedDelegates,
    fetchedDelegators,
    fetchDelegates,
    fetchDelegators,
  ]);

  return null;
}
