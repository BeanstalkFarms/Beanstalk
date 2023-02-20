import React from 'react';
import { Box, ButtonProps, Tooltip, Typography } from '@mui/material';
import { ClaimPlantAction } from '~/hooks/beanstalk/useClaimAndPlantActions';
import { ClaimPlantActionSummary } from '~/hooks/farmer/useFarmerClaimAndPlantOptions';
import { displayFullBN } from '~/util';
import Row from '../Row';
import TokenIcon from '../TokenIcon';
import SelectionItem from '../SelectionItem';

import podIconGrey from '~/img/beanstalk/pod-icon-grey.svg';
import podIconGreen from '~/img/beanstalk/pod-icon-green.svg';

import sproutsIconGrey from '~/img/beanstalk/sprout-icon-grey.svg';
import sproutsIconGreen from '~/img/beanstalk/sprout-icon-green.svg';

import beanIconGreen from '~/img/tokens/bean-logo-circled-wintergreen.svg';
import beanIconGrey from '~/img/tokens/bean-logo-circled-grey.svg';

const icons = {
  [ClaimPlantAction.HARVEST]: {
    selected: podIconGreen,
    grey: podIconGrey,
  },
  [ClaimPlantAction.RINSE]: {
    selected: sproutsIconGreen,
    grey: sproutsIconGrey,
  },
  [ClaimPlantAction.CLAIM]: {
    selected: beanIconGreen,
    grey: beanIconGrey,
  },
};

type Props = {
  option: ClaimPlantAction;
  summary: ClaimPlantActionSummary;
  selected: boolean;
  required?: boolean;
} & Partial<ButtonProps['onClick']>;

const ClaimPlantAccordionPill: React.FC<Props> = ({
  option,
  summary,
  selected,
  ...props
}) => {
  const disabled = !summary?.enabled || summary?.claimable?.amount?.lte(0);
  if (!('claimable' in summary) || !summary.claimable) return null;

  return (
    <Tooltip title={disabled ? `Nothing to ${summary.title.toLowerCase()}` : ''}>
      <Box>
        <SelectionItem
          {...props}
          selected={selected}
          disabled={disabled}
          variant="pill"
        >
          <Row gap={0.5} sx={{ width: 'fit-content' }}>
            <TokenIcon
              token={summary.claimable.token}
              logoOverride={
                icons[option as keyof typeof icons]?.[
                  selected && !disabled ? 'selected' : 'grey'
                ] || undefined
              }
            />
            <Typography variant="bodySmall">
              + {displayFullBN(summary.claimable.amount, 2)}
            </Typography>
          </Row>
        </SelectionItem>
      </Box>
    </Tooltip>
  );
};

export default ClaimPlantAccordionPill;
