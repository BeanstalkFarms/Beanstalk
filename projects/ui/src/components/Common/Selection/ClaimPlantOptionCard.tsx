import React from 'react';
import { Typography, Stack, ButtonProps, Tooltip } from '@mui/material';
import { Partial } from '@react-spring/types';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { ClaimPlantAction } from '~/hooks/beanstalk/useClaimAndPlantActions';
import { ClaimPlantActionSummary } from '~/hooks/farmer/useFarmerClaimAndPlantOptions';
import { displayFullBN } from '~/util';
import Row from '../Row';
import TokenIcon from '../TokenIcon';
import SelectionItem from './SelectionItem';

import podIconGrey from '~/img/beanstalk/pod-icon-grey.svg';

import sproutsIconGrey from '~/img/beanstalk/sprout-icon-grey.svg';

import beanIconGrey from '~/img/tokens/bean-logo-circled-grey.svg';

import seedIconGrey from '~/img/beanstalk/seed-icon-grey.svg';
import stalkIconGrey from '~/img/beanstalk/stalk-icon-grey.svg';
import LockIcon from '~/img/misc/lock-icon.svg';

const icons = {
  SEED: seedIconGrey,
  POD: podIconGrey,
  SPROUT: sproutsIconGrey,
  BEAN: beanIconGrey,
  STALK: stalkIconGrey,
};

export type ClaimPlantSelectionItemProps = {
  option: ClaimPlantAction;
  summary: ClaimPlantActionSummary;
  selected: boolean;
  required?: boolean;
} & Partial<ButtonProps['onClick']>;

const tooltipIconProps = {
  sx: {
    color: 'text.secondary' as const,
    display: 'inline' as const,
    mb: 0.5 as const,
    fontSize: '11px' as const,
  },
};

const ClaimPlantAccordionCard: React.FC<ClaimPlantSelectionItemProps> = ({
  summary,
  selected,
  required,
  ...props
}) => (
  <SelectionItem
    {...props}
    selected={selected}
    checkIcon="top-left"
    disabled={!summary.enabled}
    title={
      <Row gap={0.5}>
        {required && (
          <img src={LockIcon} alt="" css={{ width: '1rem', height: '1rem' }} />
        )}
        <Typography color="inherit">
          {summary.title}
          <Tooltip title={summary.tooltip}>
            <HelpOutlineIcon {...tooltipIconProps} />
          </Tooltip>
        </Typography>
      </Row>
    }
    sx={{
      opacity: required && selected ? 0.75 : 1,
      cursor: required ? 'default' : 'pointer',
    }}
  >
    <Stack gap={0.5}>
      {summary.summary.map(({ token, description, amount, tooltip }, i) => (
        <Row justifyContent="space-between" key={description + i.toString}>
          <Row gap={0.5}>
            <TokenIcon
              token={token}
              logoOverride={
                icons[token.symbol as keyof typeof icons] || undefined
              }
            />
            <Typography>
              {description}
              <Tooltip title={tooltip} placement="bottom">
                <HelpOutlineIcon {...tooltipIconProps} />
              </Tooltip>
            </Typography>
          </Row>
          <Typography>{displayFullBN(amount, 2)}</Typography>
        </Row>
      ))}
      <Row />
    </Stack>
  </SelectionItem>
);

export default ClaimPlantAccordionCard;
