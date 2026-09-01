import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import BigNumber from 'bignumber.js';
import { AdvancedPipeStruct, Clipboard } from '@beanstalk/sdk';
import { useProposalsLazyQuery } from '~/generated/graphql';
import { AddressMap, MULTISIGS } from '~/constants';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { tokenResult } from '~/util';
import { SNAPSHOT_SPACES } from '~/lib/Beanstalk/Governance';
import { useTokens } from '~/hooks/beanstalk/useTokens';
import useL2OnlyEffect from '~/hooks/chain/useL2OnlyEffect';
import {
  resetBeanstalkGovernance,
  updateActiveProposals,
  updateMultisigBalances,
} from './actions';

export const useFetchBeanstalkGovernance = () => {
  const dispatch = useDispatch();
  const beanstalk = useBeanstalkContract();
  const { BEAN } = useTokens();

  const [getProposals] = useProposalsLazyQuery({
    variables: {
      space_in: SNAPSHOT_SPACES,
      state: 'active',
    },
    fetchPolicy: 'network-only',
    context: { subgraph: 'snapshot' },
  });

  /// Handlers
  const fetch = useCallback(async () => {
    if (beanstalk) {
      const clipboard = Clipboard.encode([]);
      const balanceCalls: AdvancedPipeStruct[] = MULTISIGS.map((address) => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('getBalance', [
          address,
          BEAN.address,
        ]),
        clipboard,
      }));

      const [proposalsResult, multisigBalances] = await Promise.all([
        getProposals(),
        beanstalk.callStatic
          .advancedPipe(balanceCalls, '0')
          .then((results) =>
            results.map((result) =>
              tokenResult(BEAN)(
                beanstalk.interface.decodeFunctionResult(
                  'getBalance',
                  result
                )[0]
              )
            )
          )
      ]);

      // Update proposals
      if (Array.isArray(proposalsResult.data?.proposals)) {
        dispatch(
          updateActiveProposals(
            proposalsResult
              .data!.proposals /// HACK:
              /// The snapshot.org graphql API defines that the proposals
              /// array can have `null` elements. I believe this shouldn't
              /// be allowed, but to fix we check for null values and manually
              /// assert existence of `p`.
              .filter(
                (p) =>
                  p !== null &&
                  (((p.title.startsWith('BIP') || p.title.startsWith('BOP')) &&
                    p.space?.id === 'beanstalkdao.eth') ||
                    ((p.title.startsWith('Temp-Check') ||
                      p.title.startsWith('BFCP')) &&
                      p.space?.id === 'beanstalkfarms.eth') ||
                    (p.title.startsWith('BSP') &&
                      p.space?.id === 'wearebeansprout.eth') ||
                    (p.title.startsWith('BNP') && p.space?.id === 'beanft.eth'))
              )
              .map((p) => ({
                id: p!.id,
                title: p!.title,
                start: p!.start,
                end: p!.end,
                space: p!.space,
              }))
          )
        );
      }

      // Update multisig balances
      if (multisigBalances?.length > 0) {
        dispatch(
          updateMultisigBalances(
            MULTISIGS.reduce<AddressMap<BigNumber>>((prev, address, index) => {
              prev[address] = multisigBalances[index];
              return prev;
            }, {})
          )
        );
      }
    }
  }, [beanstalk, getProposals, BEAN, dispatch]);

  const clear = useCallback(() => {
    console.debug('[beanstalk/governance/useBeanstalkGovernance] CLEAR');
    dispatch(resetBeanstalkGovernance());
  }, [dispatch]);

  return [fetch, clear] as const;
};

// -- Updater

const GovernanceUpdater = () => {
  const [fetch, clear] = useFetchBeanstalkGovernance();

  useL2OnlyEffect(() => {
    clear();
    fetch();
  }, [clear, fetch]);

  return null;
};

export default GovernanceUpdater;
