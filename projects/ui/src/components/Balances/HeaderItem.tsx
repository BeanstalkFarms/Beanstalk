import {
  Stack,
  StackProps,
  Tooltip,
  Typography,
} from '@mui/material';
import BigNumber from 'bignumber.js';
import React from 'react';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { BeanstalkToken } from '~/classes/Token';
import { displayFullBN } from '~/util';
import Row from '../Common/Row';
import TokenIcon from '../Common/TokenIcon';
import { FontSize } from '../App/muiTheme';
import { ZERO_BN } from '~/constants';

type TokenItemProps = {
  token: BeanstalkToken;
  title: string;
  amount: BigNumber;
  tooltip: string;
} & StackProps;

const HeaderItem: React.FC<TokenItemProps> = ({
  token,
  title,
  amount,
  tooltip,
  ...stackProps
}) => (
  <Stack>
    <Row width="100%" {...stackProps} gap={0.6}>
      <Typography variant="h4" color="text.primary">
        {title}
      </Typography>
      <Row gap={0.5}>
        <TokenIcon token={token} />
        <Typography variant="h4" color="text.primary" display="inline-flex">
          {displayFullBN(
            amount?.gt(0) ? amount : ZERO_BN,
            token.displayDecimals
          )}
          <Tooltip title={tooltip}>
            <HelpOutlineIcon
              sx={{ color: 'text.secondary', fontSize: FontSize.sm, ml: '3px' }}
            />
          </Tooltip>
        </Typography>
      </Row>
    </Row>
  </Stack>
);

export default HeaderItem;
