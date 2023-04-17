import React from 'react';
import { Button, Dialog, Stack, Typography } from '@mui/material';
import { StyledDialogTitle, StyledDialogContent } from '~/components/Common/Dialog';

import { FC } from '~/types';

const SunDialog: FC<{
  open: boolean;
  handleClose: () => void;
}> = ({
  open,
  handleClose,
}) => (
  <Dialog onClose={handleClose} open={open}>
    <StyledDialogTitle onClose={handleClose}>
      Confirm Sunrise
    </StyledDialogTitle>
    <StyledDialogContent>
      <Stack gap={1}>
        <Typography>TEST</Typography>
        <Button type="submit">Sunrise</Button>
      </Stack>
    </StyledDialogContent>
  </Dialog>
  );

export default SunDialog;
