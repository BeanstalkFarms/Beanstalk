import { Stack, Typography } from '@mui/material';
import React from 'react';
import { IconSize } from '~/components/App/muiTheme';
import AddressIcon from '~/components/Common/AddressIcon';
import DescriptionButton from '~/components/Common/DescriptionButton';
import { StyledDialog, StyledDialogContent, StyledDialogTitle } from '~/components/Common/Dialog';
import { FarmToMode } from '~/lib/Beanstalk/Farm';

/* FIXME: extracted from DestinationField */
const OPTIONS = [
  {
    title: 'Circulating Balance',
    description: 'Return Beans in this Order to your wallet.',
    pill: <><AddressIcon size={IconSize.xs} /><Typography variant="body1">Wallet</Typography></>,
    icon: <AddressIcon size={IconSize.small} width={IconSize.small} height={IconSize.small} />,
    value: FarmToMode.EXTERNAL,
  },
  {
    title: 'Farm Balance',
    description: 'Return Beans in this Order to your internal Beanstalk balance.',
    pill: <Typography variant="body1">🚜 Farm Balance</Typography>,
    icon: '🚜',
    value: FarmToMode.INTERNAL,
  },
];

type IProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (destination: FarmToMode) => void;
}

const FarmToModeDialog: React.FC<IProps> = ({ open, onClose, onSubmit }) => (
  <StyledDialog open={open} onClose={onClose} transitionDuration={0}>
    <StyledDialogTitle onClose={onClose}>
      Destination
    </StyledDialogTitle>
    <StyledDialogContent>
      <Stack gap={1}>
        {OPTIONS.map((option, index) => (
          <DescriptionButton
            key={index}
            {...option}
            onClick={() => onSubmit(option.value)}
            fullWidth
            disableRipple
              />
        ))}
      </Stack>
    </StyledDialogContent>
  </StyledDialog>
  );

export default FarmToModeDialog;
