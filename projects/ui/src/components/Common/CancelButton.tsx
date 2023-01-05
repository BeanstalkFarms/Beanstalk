import React from 'react';
import {
  Button, ButtonProps,
  Stack, Typography,
} from '@mui/material';

import { FC } from '~/types';

const CancelButton: FC<ButtonProps & { buttonText?: string; }> = ({ onClick, buttonText }) => (
  <Stack justifyContent="end" height="100%">
    <Button sx={{ p: 1 }} onClick={onClick} color="cancel">
      <Typography variant="h4">
        {buttonText !== undefined ? (buttonText) : 'Cancel'}
      </Typography>
    </Button>
  </Stack>
);

export default CancelButton;
