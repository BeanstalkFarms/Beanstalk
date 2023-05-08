import React from 'react';
import { Dialog, DialogProps } from '@mui/material';
import BigNumber from 'bignumber.js';
import { PlotMap } from '~/util';
import { StyledDialogContent, StyledDialogTitle } from '../Common/Dialog';
import PlotSelect from '../Common/Form/PlotSelect';
import EmptyState from '../Common/ZeroState/EmptyState';

import { FC } from '~/types';
import { PlotFragment } from '../Common/Form';

export interface PlotSelectDialogProps {
  /** Closes dialog */
  handleClose: any;
  /** Sets plot index */
  handlePlotSelect: any;
  /** */
  plots: PlotMap<BigNumber>;
  /** */
  harvestableIndex: BigNumber;
  /** index of the selected plot */
  selected?: PlotFragment[] | string | PlotFragment | null;
  /** Enable selection of multiple plots*/
  multiSelect?: boolean | undefined;
}

const PlotSelectDialog: FC<PlotSelectDialogProps & DialogProps> = ({
  // Custom
  handleClose,
  handlePlotSelect,
  plots,
  harvestableIndex,
  selected,
  multiSelect,
  // Dialog
  onClose,
  open,
}) => {
  // sets plot index then closes dialog
  const handleSelectAndClose = (index: string) => {
    handlePlotSelect(index);
    if (Object.keys(plots).length == 1 || !multiSelect) {
      handleClose();
    }
  };

  return (
    <Dialog onClose={handleClose} open={open} fullWidth>
      <StyledDialogTitle onClose={handleClose}>My Plots</StyledDialogTitle>
      <StyledDialogContent
        sx={{
          pb: 1, // enforces 10px padding around all
        }}
      >
        {Object.keys(plots).length > 0 ? (
          <PlotSelect
            handlePlotSelect={handleSelectAndClose}
            plots={plots!}
            harvestableIndex={harvestableIndex}
            selected={selected}
          />
        ) : (
          <EmptyState message="You have no Plots." />
        )}
      </StyledDialogContent>
    </Dialog>
  );
};

export default PlotSelectDialog;
