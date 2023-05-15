import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { GovSpace } from '~/lib/Beanstalk/Governance';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import { ZERO_BN } from '~/constants';
import { useAppSelector } from '~/state';
import useFarmerBeaNFTs from '~/hooks/farmer/useFarmerBeaNFTs';

/**
 * Returns the voting power of the farmer and their delegators.
 * The voting power returned here is not the voting power for a specific proposal.
 *
 * To obtain the voting power for a specific proposal, use `useProposalVotingPowerQuery`.
 */
export default function useFarmerVotingPower(space: GovSpace) {
  const farmerDelegators = useAppSelector(
    (state) => state._farmer.delegations.delegators
  );
  const farmerSilo = useFarmerSilo();
  const farmerBeaNFTsResult = useFarmerBeaNFTs();

  const _delegators = farmerDelegators.votingPower;

  const isBeaNFT = space === GovSpace.BeanNFT;

  const delegators = useMemo(() => {
    const delegation = _delegators[space] || {};
    return Object.entries(delegation).map(([_address, _amount]) => ({
      address: _address,
      amount: _amount,
    }));
  }, [_delegators, space]);

  const farmerVotingPower = useMemo(() => {
    if (isBeaNFT) {
      const nfts = Object.values(farmerBeaNFTsResult.data)[0];
      if (!nfts) return ZERO_BN;
      const barnRaise = nfts.barnRaise;
      const winter = nfts.winter;
      const genesis = nfts.genesis;

      return new BigNumber(
        barnRaise.ids.length + winter.ids.length + genesis.ids.length
      );
    }
    return farmerSilo.stalk.active;
  }, [farmerBeaNFTsResult.data, farmerSilo.stalk.active, isBeaNFT]);

  const delegatorsVotingPower = useMemo(
    () =>
      delegators.reduce<BigNumber>(
        (acc, curr) => acc.plus(curr.amount),
        ZERO_BN
      ),
    [delegators]
  );

  return {
    delegators,
    votingPower: {
      farmer: farmerVotingPower,
      delegated: delegatorsVotingPower,
      total: farmerVotingPower.plus(delegatorsVotingPower),
    },
  };
}
