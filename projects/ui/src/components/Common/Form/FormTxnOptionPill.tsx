import React from 'react';
import { Box, ButtonProps, Tooltip, Typography } from '@mui/material';
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
import { FormTxn } from '~/util/FormTxns';
import { FormTxnSummary } from '~/hooks/farmer/form-txn/useFarmerFormTxnsSummary';

const icons = {
  [FormTxn.HARVEST]: {
    selected: podIconGreen,
    grey: podIconGrey,
  },
  [FormTxn.RINSE]: {
    selected: sproutsIconGreen,
    grey: sproutsIconGrey,
  },
  [FormTxn.CLAIM]: {
    selected: beanIconGreen,
    grey: beanIconGrey,
  },
};

type Props = {
  option: FormTxn;
  summary: FormTxnSummary;
  selected: boolean;
  required?: boolean;
} & Partial<ButtonProps['onClick']>;

const FormTxnOptionPill: React.FC<Props> = ({
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

export default FormTxnOptionPill;
