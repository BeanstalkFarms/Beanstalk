import React from 'react';
import { Stack, Typography } from '@mui/material';
import { useTokenDepositsContext } from '../Token/TokenDepositsContext';

const LambdaConvert = () => {
  const { selected } = useTokenDepositsContext();

  return (
    <Stack>
      <Typography variant="subtitle1">
        {selected.size} Deposits selected
      </Typography>
    </Stack>
  );
};

export default LambdaConvert;
