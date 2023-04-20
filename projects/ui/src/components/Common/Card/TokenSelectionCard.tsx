import { Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import React from 'react';
import Token from '~/classes/Token';
import SelectionCard, {
  SelectionCardProps,
} from '~/components/Common/Card/SelectionCard';
import { displayBN } from '~/util';
import TokenIcon from '../TokenIcon';

export type TokenSelectionCardProps = {
  token: Token;
  title?: string;
  amount: BigNumber;
} & SelectionCardProps;

const TokenSelectionCard: React.FC<TokenSelectionCardProps> = ({
  token,
  title,
  amount,
  ...props
}) => (
  <SelectionCard {...props}>
    <Stack gap={0.2} width="100%" alignItems="flex-start">
      <Typography
        color={props.disabled ? 'text.disabled' : 'text.primary'}
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          flexWrap: 'nowrap',
        }}
      >
        <TokenIcon token={token} css={{ marginRight: '5px' }} />
        {amount.gt(0) ? displayBN(amount) : '0'}
      </Typography>
      <Typography
        color={props.disabled ? 'text.disabled' : 'text.primary'}
        sx={{ whiteSpace: 'nowrap' }}
      >
        {title || token.symbol}
      </Typography>
    </Stack>
  </SelectionCard>
);

export default TokenSelectionCard;
