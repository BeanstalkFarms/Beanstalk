import React from 'react';
import { useAccount } from 'wagmi';
import NetworkDialog from '~/components/Common/Connection/NetworkDialog';
import { SupportedChainId } from '~/constants';

const BackdropProps = {
  sx: {
    backgroundColor: 'rgba(0,0,0,0.75) !important',
  },
};

const EnforceNetwork: React.FC = () => {
  const { isConnected, chain } = useAccount();
  const isValid = !!chain?.id && !!SupportedChainId[chain?.id];

  if (!isConnected || isValid) return null;

  return (
    <NetworkDialog open handleClose={undefined} BackdropProps={BackdropProps} />
  );
};

export default EnforceNetwork;
