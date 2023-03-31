import React from 'react';
import { Token } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { Typography } from '@mui/material';
import { FC } from '~/types';
import SelectionItem, { SelectionItemProps } from '../SelectionItem';
import { FontSize, FontWeight } from '~/components/App/muiTheme';
import { displayBN } from '~/util';
import Row from '../Row';
import TokenIcon from '../TokenIcon';

type Props = {
  token: Token;
  amount: BigNumber;
} & Omit<SelectionItemProps, 'title'>;

const TokenSelectionCard: FC<Props> = ({ token, amount, ...props }) => (
  <SelectionItem
    title={
      <Row gap={0.2}>
        <TokenIcon
          token={token}
          css={{ height: FontSize.sm, marginRight: '5px' }}
        />
        <Typography
          variant="bodySmall"
          fontWeight={FontWeight.semiBold}
          component="span"
          sx={{ flexWrap: 'nowrap' }}
        >
          {amount.gt(0) ? displayBN(amount) : '0'}
        </Typography>
      </Row>
    }
    checkIcon="top-right"
    gap={0.2}
    {...props}
  />
);

export default TokenSelectionCard;
