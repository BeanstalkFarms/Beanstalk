import React from 'react';
import { Typography, Stack, Tooltip } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import BigNumber from 'bignumber.js';
import { displayFullBN } from '~/util';
import Row from '../Row';
import TokenIcon from '../TokenIcon';
import SelectionItem, { SelectionItemProps } from '../SelectionItem';

import podIconGrey from '~/img/beanstalk/pod-icon-grey.svg';

import sproutsIconGrey from '~/img/beanstalk/sprout-icon-grey.svg';

import beanIconGrey from '~/img/tokens/bean-logo-circled-grey.svg';

import seedIconGrey from '~/img/beanstalk/seed-icon-grey.svg';
import stalkIconGrey from '~/img/beanstalk/stalk-icon-grey.svg';
import LockIcon from '~/img/misc/lock-icon.svg';
import GasTag from '../GasTag';
import { FormTxn } from '~/util/FormTxns';
import { FormTxnSummary } from '~/hooks/farmer/form-txn/useFarmerFormTxnsSummary';

const icons = {
  SEED: seedIconGrey,
  POD: podIconGrey,
  SPROUT: sproutsIconGrey,
  BEAN: beanIconGrey,
  STALK: stalkIconGrey,
};

type Props = {
  option: FormTxn;
  summary: FormTxnSummary;
  selected: boolean;
  gas?: BigNumber;
  required?: boolean;
  disabledMessage?: string;
} & Omit<SelectionItemProps, 'checkIcon' | 'title' | 'variant'>;

const tooltipIconProps = {
  sx: {
    color: 'text.secondary' as const,
    display: 'inline' as const,
    mb: 0.5 as const,
    fontSize: '11px' as const,
  },
};

const FormTxnOptionCard: React.FC<Props> = ({
  summary,
  selected,
  required,
  disabledMessage,
  gas,
  ...props
}) => (
  <Tooltip
    title={
      !summary.enabled
        ? `Nothing to ${summary.title.toLowerCase()}`
        : props.disabled
        ? disabledMessage
        : ''
    }
  >
    <Stack width="100%">
      <SelectionItem
        {...props}
        selected={selected}
        checkIcon="top-left"
        disabled={props.disabled || !summary.enabled}
        title={
          <Row
            width="100%"
            justifyContent="space-between"
            sx={{ boxSizing: 'border-box', px: 1 }}
          >
            <Row gap={0.5}>
              {required && summary.enabled && (
                <img
                  src={LockIcon}
                  alt=""
                  css={{ width: '1rem', height: '1rem' }}
                />
              )}
              <Typography color="inherit">
                {summary.title}
                <Tooltip title={summary.tooltip}>
                  <HelpOutlineIcon {...tooltipIconProps} />
                </Tooltip>
              </Typography>
            </Row>
            <GasTag gasLimit={gas || null} />
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
    </Stack>
  </Tooltip>
);

export default FormTxnOptionCard;
