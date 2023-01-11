import { Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import React from 'react';
import Token from '~/classes/Token';
import SelectionCard, {
  SelectionCardProps,
} from '~/components/Common/Selection/SelectionCard';
import { displayBN } from '~/util';
import Row from '../Row';
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
      {/* FIX ME TO USE color as CONST */}
      <Row gap={0.5}>
        <TokenIcon token={token} />
        <Typography
          variant="body1"
          sx={{ color: '#4D4D4D', display: 'inline-flex' }}
          component="span"
        >
          {amount.gt(0) ? displayBN(amount) : '0'}
        </Typography>
      </Row>

      <Typography
        variant="body1"
        sx={{ color: '#4D4D4D', whiteSpace: 'nowrap' }}
      >
        {title || token.symbol}
      </Typography>
    </Stack>
  </SelectionCard>
);

export default TokenSelectionCard;
