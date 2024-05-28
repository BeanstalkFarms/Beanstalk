import React from 'react';
import { Dialog, DialogProps, useMediaQuery, useTheme } from '@mui/material';
import { FC } from '~/types';
import { StyledDialogContent, StyledDialogTitle } from '../Common/Dialog';
import EmptyState from '../Common/ZeroState/EmptyState';
import FertilizerSelect from '../Common/Form/FertilizerSelect';
import { FullFertilizerBalance } from './Actions/Transfer';

export interface FertilizerSelectDialogProps {
  /** Closes dialog */
  handleClose: any;
  /** A farmer's fertilizers */
  fertilizers: FullFertilizerBalance[];
}

const FertilizerSelectDialog: FC<FertilizerSelectDialogProps & DialogProps> = ({
  // Custom
  handleClose,
  fertilizers,
  // Dialog
  open,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog onClose={handleClose} open={open} fullWidth>
      <StyledDialogTitle onClose={handleClose}>My Fertilizer</StyledDialogTitle>
      <StyledDialogContent
        sx={{
          pb: 1, // enforces 10px padding around all
        }}
      >
        {fertilizers.length > 0 ? (
          <FertilizerSelect isMobile={isMobile} fertilizers={fertilizers} />
        ) : (
          <EmptyState message="You have no Fertilizer." />
        )}
      </StyledDialogContent>
    </Dialog>
  );
};

export default FertilizerSelectDialog;
