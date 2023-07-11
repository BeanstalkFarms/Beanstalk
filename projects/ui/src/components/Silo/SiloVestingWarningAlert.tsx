import React from 'react';
import useFarmerSiloVesting from '~/hooks/farmer/useFarmerSiloVesting';
import { displayFullBN } from '~/util';
import WarningAlert from '../Common/Alert/WarningAlert';

const SiloVestingWarningAlert: React.FC<{ hide?: boolean }> = ({
  hide = false,
}) => {
  const { amount, isVesting, remainingBlocks } = useFarmerSiloVesting();

  if (!isVesting || hide) return null;

  return (
    <WarningAlert>
      {`${
        amount.gte(1) ? displayFullBN(amount, 0) : '<1'
      } BEANs are vesting and will be available for plant in ${remainingBlocks} blocks`}
    </WarningAlert>
  );
};

export default SiloVestingWarningAlert;
