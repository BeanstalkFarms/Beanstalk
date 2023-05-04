import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { GovSpace } from '~/lib/Beanstalk/Governance';
import useFarmerDelegations from '~/hooks//farmer/useFarmerDelegations';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import { ZERO_BN } from '~/constants';
import useAccount from '~/hooks/ledger/useAccount';

export default function useFarmerVotingPower(space: GovSpace) {
  const farmerDelegations = useFarmerDelegations();
  const farmerSilo = useFarmerSilo();
  const account = useAccount();

  const delegators = useMemo(() => {
    const delegation = farmerDelegations.votingPower[space] || {};
    const _delegators = Object.entries(delegation).map(
      ([_address, _amount]) => ({
        address: _address,
        amount: _amount,
      })
    );

    return _delegators;
  }, [farmerDelegations.votingPower, space]);

  const votingPower = useMemo(() => {
    const myBeaNFTs =
      farmerDelegations.votingPower[GovSpace.BeanNFT]?.[account || ''] ||
      ZERO_BN;

    const isNFT = space === GovSpace.BeanNFT;

    const farmerVP = isNFT ? myBeaNFTs : farmerSilo.stalk.active;
    const delegatedVP = delegators.reduce<BigNumber>(
      (acc, curr) => acc.plus(curr.amount),
      ZERO_BN
    );

    return {
      farmer: farmerVP,
      delegated: delegatedVP,
      total: isNFT ? delegatedVP : farmerVP.plus(delegatedVP),
    };
  }, [
    account,
    delegators,
    farmerDelegations.votingPower,
    farmerSilo.stalk.active,
    space,
  ]);

  return {
    delegators,
    votingPower,
  };
}
