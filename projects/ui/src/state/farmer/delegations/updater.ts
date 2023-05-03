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
import { FarmerDelegation } from '.';
import {
  setDelegatorsVotingPower,
  setFarmerDelegates,
  setFarmerDelegators,
} from './actions';
import { useDelegatesRegistryContract } from '~/hooks/ledger/useContract';
import useFarmerDelegations from '~/hooks/farmer/useFarmerDelegations';
import { GOV_SPACE_BY_ID, tokenResult } from '~/util';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import { STALK } from '~/constants/tokens';

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
  const [fetchDelegatesDevOnly] = useReadDelegatesDev();
  const account = useAccount();

  const dispatch = useDispatch();

  const [fetchDelegates] = useVoterDelegatesLazyQuery({
    variables: { space_in: SNAPSHOT_SPACES, voter_address: account || '' },
    fetchPolicy: 'cache-and-network',
    context: { subgraph: 'snapshot-labs' },
  });

  const [fetchDelegators] = useVoterDelegatorsLazyQuery({
    variables: { space_in: SNAPSHOT_SPACES, voter_address: account || '' },
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

  const clear = useCallback(() => {
    dispatch(setFarmerDelegates({}));
    dispatch(setFarmerDelegators({}));
  }, [dispatch]);

  useEffect(() => {
    if (!account) {
      clear();
    }
  }, [account, clear]);

  return [fetchVoterDelegates, fetchVoterDelegators] as const;
}

export function useFetchNFTVotingPower() {
  const delegations = useFarmerDelegations();
  const account = useAccount();

  const [fetchBeaNFTs] = useBeaNftUsersLazyQuery();

  const dispatch = useDispatch();

  const delegators = useMemo(() => {
    if (!account) return [];
    const nftDelegators = delegations.delegators[GovSpace.BeanNFT] || {};
    const _delegators = new Set(
      Object.values(nftDelegators).map(({ address }) => address.toLowerCase())
    );
    _delegators.add(account.toLowerCase());

    return Array.from(_delegators);
  }, [account, delegations.delegators]);

  const fetch = useCallback(async () => {
    try {
      if (!account || !delegators.length) return;
      const data = await fetchBeaNFTs({
        variables: { id_in: delegators },
        fetchPolicy: 'cache-and-network',
        context: { subgraph: 'beanft' },
      });
      const byUser = data.data?.beaNFTUsers || [];
      const votingPower = byUser.reduce<{
        [address: string]: BigNumber;
      }>((acc, curr) => {
        const genesis = curr.genesis?.length || 0;
        const winter = curr.winter?.length || 0;
        const barnRaise = curr.barnRaise?.length || 0;
        acc[curr.id] = new BigNumber(genesis + winter + barnRaise);
        return acc;
      }, {});

      console.debug('[useFetchNFTVotingPower] RESULT = ', votingPower);
      dispatch(
        setDelegatorsVotingPower({
          space: GovSpace.BeanNFT,
          data: votingPower,
        })
      );

      return votingPower;
    } catch (err) {
      console.debug('[useFetchNFTVotingPower] FAILED:', err);
      return undefined;
    }
  }, [account, delegators, dispatch, fetchBeaNFTs]);

  const clear = useCallback(() => {
    dispatch(
      setDelegatorsVotingPower({
        space: GovSpace.BeanNFT,
        data: {},
      })
    );
  }, [dispatch]);

  useEffect(() => {
    if (!account) {
      clear();
    }
  }, [account, clear]);

  return [fetch, clear] as const;
}

export function useFetchStalkVotingPower() {
  const delegations = useFarmerDelegations();
  const farmerSilo = useFarmerSilo();
  const account = useAccount();

  const dispatch = useDispatch();

  const [fetchDelegatorsStalk] = useDelegatorsStalkLazyQuery();

  const activeStalk = farmerSilo.stalk.active;

  const delegators = useMemo(() => {
    if (!account) return [];
    const accounts = new Set<string>();
    const _stalkDelegators = Object.entries(delegations.delegators);

    _stalkDelegators.forEach(([_space, _delegators]) => {
      const space = _space as GovSpace;
      if (space === GovSpace.BeanNFT) return;
      Object.values(_delegators).forEach(({ address }) => {
        accounts.add(address.toLowerCase());
      });
    });

    return Array.from(accounts);
  }, [account, delegations.delegators]);

  const fetch = useCallback(async () => {
    try {
      if (!account || !delegators.length || activeStalk.lte(0)) return;
      const data = await fetchDelegatorsStalk({
        variables: { ids: delegators },
        fetchPolicy: 'cache-and-network',
        context: { subgraph: 'beanstalk' },
      });

      const stalkByFarmer = (data.data?.farmers || []).reduce<{
        [address: string]: BigNumber;
      }>((acc, curr) => {
        const result = tokenResult(STALK)(curr.silo?.stalk || 0);
        acc[curr.id.toLowerCase()] = result;
        return acc;
      }, {});

      const votingPower: {
        [key in GovSpace]: {
          [address: string]: BigNumber;
        };
      } = {
        [GovSpace.BeanSprout]: {},
        [GovSpace.BeanstalkFarms]: {},
        [GovSpace.BeanstalkDAO]: {},
        [GovSpace.BeanNFT]: {},
      };

      votingPower[GovSpace.BeanSprout][account.toLowerCase()] = activeStalk;
      votingPower[GovSpace.BeanstalkFarms][account.toLowerCase()] = activeStalk;
      votingPower[GovSpace.BeanstalkDAO][account.toLowerCase()] = activeStalk;

      Object.entries(delegations.delegators).forEach(([s, d]) => {
        const space = s as GovSpace;
        if (space !== GovSpace.BeanNFT) {
          Object.keys(d).forEach((address) => {
            const vp = stalkByFarmer[address.toLowerCase()];
            if (vp) {
              votingPower[space][address] = vp;
            }
          });
        }
      });

      const spaces = [
        GovSpace.BeanSprout,
        GovSpace.BeanstalkDAO,
        GovSpace.BeanstalkFarms,
      ];
      spaces.forEach((space) => {
        if (space === GovSpace.BeanNFT) return;
        const vp = votingPower[space as GovSpace];
        console.log('vp: ', space, vp);
        if (vp) {
          dispatch(
            setDelegatorsVotingPower({
              space: space as GovSpace,
              data: vp,
            })
          );
          console.debug(
            '[useFetchStalkVotingPower] SET DELEGATORS VOTING POWER: ',
            space,
            vp
          );
        }
      });
      votingPower[GovSpace.BeanNFT] = {};

      return votingPower;
    } catch (err) {
      console.debug('[useFetchStalkVotingPower] FAILED:', err);
      return undefined;
    }
  }, [
    account,
    activeStalk,
    delegations.delegators,
    delegators,
    dispatch,
    fetchDelegatorsStalk,
  ]);

  const clear = useCallback(() => {
    const spaces = [
      GovSpace.BeanSprout,
      GovSpace.BeanstalkDAO,
      GovSpace.BeanstalkFarms,
    ];
    spaces.forEach((space) => {
      dispatch(
        setDelegatorsVotingPower({
          space,
          data: {},
        })
      );
    });
  }, [dispatch]);

  useEffect(() => {
    if (!account) {
      clear();
    }
  }, [account, clear]);

  return [fetch, clear] as const;
}

export default function FarmerDelegationsUpdater() {
  const [fetchDelegates, fetchDelegators] = useFetchFarmerDelegations();
  const [fetchNFTVP] = useFetchNFTVotingPower();
  const [fetchStalkVP] = useFetchStalkVotingPower();

  const account = useAccount();

  useEffect(() => {
    if (!account) return;
    fetchDelegators(account);
    fetchDelegates(account);
  }, [account, fetchDelegates, fetchDelegators]);

  useEffect(() => {
    if (!account) return;
    fetchNFTVP();
    fetchStalkVP();
  }, [account, fetchNFTVP, fetchStalkVP]);

  return null;
}
