import React from 'react';
import { Dialog, DialogProps } from '@mui/material';
import { FC } from '~/types';
import { StyledDialogContent, StyledDialogTitle } from '../Common/Dialog';
import EmptyState from '../Common/ZeroState/EmptyState';
import FertilizerSelect from '../Common/Form/FertilizerSelect';

export interface PlotSelectDialogProps {
  /** Closes dialog */
  handleClose: any;
  /** Custom function to set the selected fertilizer */
  handleSelect: any;
  /** A farmer's fertilizers */
  fertilizers: any[];
  /** List of selected fertilizers */
  selected?: any[];
}

const FertilizerSelectDialog: FC<PlotSelectDialogProps & DialogProps> = ({
  // Custom
  handleClose,
  handleSelect,
  fertilizers,
  selected,
  // Dialog
  open,
}) => {
  // sets plot index then closes dialog
  const handleSelectAndClose = (selectedFert: any) => {
    handleSelect(selectedFert);
    if (fertilizers.length === 1) {
      handleClose();
    }
  };

  return (
    <Dialog onClose={handleClose} open={open} fullWidth>
      <StyledDialogTitle onClose={handleClose}>My Fertilizer</StyledDialogTitle>
      <StyledDialogContent
        sx={{
          pb: 1, // enforces 10px padding around all
        }}
      >
        {fertilizers.length > 0 ? (
          <FertilizerSelect
            handleSelect={handleSelectAndClose}
            fertilizers={fertilizers}
            selected={selected}
          />
        ) : (
          <EmptyState message="You have no Fertilizer." />
        )}
      </StyledDialogContent>
    </Dialog>
  );
};

export default FertilizerSelectDialog;
