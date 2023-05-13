import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { GovSpace } from '~/lib/Beanstalk/Governance';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import { ZERO_BN } from '~/constants';
import { useAppSelector } from '~/state';
import useFarmerBeaNFTs from '~/hooks/farmer/useFarmerBeaNFTs';

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
      const { barnRaise, winter, genesis } = nfts;

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
