import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import useChainConstant from '~/hooks/chain/useChainConstant';
import { useBeanstalkContract, useFertilizerContract } from '~/hooks/ledger/useContract';
import { REPLANT_INITIAL_ID } from '~/hooks/beanstalk/useHumidity';
import useChainId from '~/hooks/chain/useChainId';
import { tokenResult } from '~/util';
import useBlocks from '~/hooks/ledger/useBlocks';
import useAccount from '~/hooks/ledger/useAccount';
import { resetFarmerBarn, updateFarmerBarn } from './actions';
import useEvents, { GetQueryFilters } from '../events2/updater';
import { EventCacheName } from '../events2';
import { castFertilizerBalance } from '~/state/farmer/barn';
import { SPROUTS } from '~/constants/tokens';
import { useFertilizerBalancesLazyQuery } from '~/generated/graphql';

export const useFetchFarmerBarn = () => {
  /// Helpers
  const dispatch  = useDispatch();
  const replantId = useChainConstant(REPLANT_INITIAL_ID);

  /// Contracts
  const [fetchFertBalances] = useFertilizerBalancesLazyQuery();
  const fertContract = useFertilizerContract();
  const beanstalk    = useBeanstalkContract();
  const blocks       = useBlocks();
  const account      = useAccount();

  /// Events
  const getQueryFilters = useCallback<GetQueryFilters>((
    _account,
    fromBlock,
    toBlock,
  ) => [
    /// Send FERT
    fertContract.queryFilter(
      fertContract.filters.TransferSingle(
        null,     // operator
        _account, // from
        null,     // to
        null,     // id
        null,     // value
      ),
      fromBlock || blocks.FERTILIZER_LAUNCH_BLOCK,
      toBlock   || 'latest',
    ),
    fertContract.queryFilter(
      fertContract.filters.TransferBatch(
        null,     // operator
        _account, // from
        null,     // to
        null,     // ids
        null,     // values
      ),
      fromBlock || blocks.FERTILIZER_LAUNCH_BLOCK,
      toBlock   || 'latest',
    ),
    /// Receive FERT
    fertContract.queryFilter(
      fertContract.filters.TransferSingle(
        null,     // operator
        null,     // from
        _account, // to
        null,     // id
        null,     // value
      ),
      fromBlock || blocks.FERTILIZER_LAUNCH_BLOCK,
      toBlock   || 'latest',
    ),
    fertContract.queryFilter(
      fertContract.filters.TransferBatch(
        null,     // operator
        null,     // from
        _account, // to
        null,     // ids
        null,     // values
      ),
      fromBlock || blocks.FERTILIZER_LAUNCH_BLOCK,
      toBlock   || 'latest',
    ),
  ], [blocks.FERTILIZER_LAUNCH_BLOCK, fertContract]);

  const [fetchEvents] = useEvents(EventCacheName.FERTILIZER, getQueryFilters);

  const initialized = (
    fertContract
    && account 
    && fetchEvents
  );

  /// Handlers 
  const fetch = useCallback(async () => {
    if (initialized) {
      console.debug('[farmer/fertilizer/updater] FETCH: ', replantId.toString());

      const query = await fetchFertBalances({ variables: { account }, fetchPolicy: 'network-only', });
      const balances = query.data?.fertilizerBalances.map(castFertilizerBalance) || [];
      const idStrings = balances.map((bal) => bal.token.id.toString());

      const [
        unfertilized,
        fertilized,
      ] = await Promise.all([
        /// How much of each ID is Unfertilized (aka a Sprout)
        beanstalk.balanceOfUnfertilized(account, idStrings).then(tokenResult(SPROUTS)),
        /// How much of each ID is Fertilized   (aka a Fertilized Sprout)
        beanstalk.balanceOfFertilized(account, idStrings).then(tokenResult(SPROUTS)),
      ] as const);

      console.debug('[farmer/fertilizer/updater] RESULT: balances =', balances, unfertilized.toString(), fertilized.toString());

      /// FIXME: Fallback to `fetchEvents()` if subgraph fails.
      /// Fetch new events and re-run the processor.
      // const allEvents = await fetchEvents();
      // const { tokens } = new ERC1155EventProcessor(account, 0).ingestAll(allEvents || []);
      // const ids = Object.keys(tokens);
      // const idStrings = ids.map((id) => id.toString());
      
      /// Key the amount of fertilizer by ID.
      // let sum = ZERO_BN;
      // const fertById = balances.reduce((prev, curr, index) => {
      //   sum = sum.plus(new BigNumber(curr.amount.toString()));
      //   prev[ids[index]] = toTokenUnitsBN(curr.amount.toString(), 0);
      //   return prev;
      // }, {} as { [key: string] : BigNumber });
      // console.debug('[farmer/fertilizer/updater] fertById =', fertById, sum.toString());

      dispatch(updateFarmerBarn({
        balances,
        unfertilizedSprouts: unfertilized,
        fertilizedSprouts:   fertilized,
      }));
    }
  }, [
    dispatch,
    beanstalk,
    replantId,
    initialized,
    account,
    fetchFertBalances,
  ]); 

  const clear = useCallback(() => { 
    dispatch(resetFarmerBarn());
  }, [dispatch]);

  return [fetch, Boolean(initialized), clear] as const;
};

const FarmerBarnUpdater = () => {
  const [fetch, initialized, clear] = useFetchFarmerBarn();
  const account = useAccount();
  const chainId = useChainId();

  useEffect(() => {
    clear();
    if (account && initialized) fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, chainId, initialized]);

  return null;
};

export default FarmerBarnUpdater;
