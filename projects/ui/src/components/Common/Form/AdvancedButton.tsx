import React from 'react';
import { Button, ButtonProps, Typography } from '@mui/material';
import DropdownIcon from '../DropdownIcon';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

// FIXME: make a MUI button variant for this
const AdvancedButton : FC<{ 
  open: boolean;
} & ButtonProps> = ({
  open,
  ...props
}) => (
  <Button
    variant="outlined" // usually "contained"
    color="light"
    sx={{ color: 'text.primary' }}
    size="small"
    {...props}
  >
    <Row gap={0.5}>
      <Typography fontSize="bodySmall">Advanced</Typography>
      <DropdownIcon
        open={open}
        sx={{ fontSize: 18 }}
        mode="right-rotate"
      />
    </Row>
  </Button>
);

export default AdvancedButton;
