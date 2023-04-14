import React from 'react';
import NetworkDialog from '~/components/Common/Connection/NetworkDialog';
import { SupportedChainId } from '~/constants';
import useChainId from '~/hooks/chain/useChainId';

const BackdropProps = { 
  sx: { 
    backgroundColor: 'rgba(0,0,0,0.75) !important',
  }
};

const EnforceNetwork : React.FC = () => {
  const chainId = useChainId();
  const isValid = !!SupportedChainId[chainId];
  
  if (isValid) return null;

  return (
    <NetworkDialog
      open
      handleClose={undefined}
      BackdropProps={BackdropProps}
    />
  );
};

export default EnforceNetwork;
