import { Button } from '@mui/material';
import { useAtomValue } from 'jotai';
import React, { useCallback } from 'react';
import { buyFieldsAtomAtom, PodOrderType } from '../info/atom-context';

const SubmitMarketAction: React.FC<{}> = () => {
  const fields = useAtomValue(buyFieldsAtomAtom);

  const submit = useCallback(() => {
    console.log('submitting order... ');
  }, []);

  return (
    <Button variant="contained" color="primary" size="medium" onClick={submit}>
      {fields.orderType === PodOrderType.ORDER ? 'Order Pods' : 'Fill Order'}
    </Button>
  );
};

export default SubmitMarketAction;
