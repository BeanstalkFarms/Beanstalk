import { Box, CircularProgress, Tooltip, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import React from 'react';
import { Token } from '~/classes';
import { displayFullBN } from '~/util';
import TokenIcon from '../TokenIcon';
import OutputField from './OutputField';
import { IconSize } from '../../App/muiTheme';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

const TokenOutputField : FC<{
  /** */
  token: Token;
  /** The `amount` of `token` */
  amount: BigNumber;
  /** The $ value (or other derived value) of the `amount` */
  amountSecondary?: string | BigNumber;
  /** Annotate the token with some modifier ("Claimable", "Harvestable") */
  modifier?: string;
  /** Display as a delta (show +/-). */
  isDelta?: boolean;
  /** Display a loading spinner */
  isLoading?: boolean;
  /** */
  amountTooltip?: string | JSX.Element;
  /** Override the end adornment section */
  override?: any;
  /** */
  size?: 'small';
}> = ({
  token,
  amount,
  amountSecondary,
  modifier,
  amountTooltip = '',
  isDelta = true,
  isLoading = false,
  override,
  size,
}) => {
  const isZero     = amount.eq(0);
  const isNegative = amount.lt(0);
  const prefix     = (!isDelta || isZero) ? '' : isNegative ? '-' : '+';
  return (
    <OutputField isNegative={isNegative} size={size}>
      {!isLoading ? (
        <Tooltip title={amountTooltip}>
          <Typography display="inline" variant={size === 'small' ? 'body1' : 'bodyLarge'} sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' } }}>
            {amount.abs().gt(new BigNumber(1000000)) ? (
              <>
                {prefix}&nbsp;{displayFullBN(amount.abs(), 0)}
              </>
            ) : (
              <>
                {prefix}&nbsp;{displayFullBN(amount.abs(), token.displayDecimals, token.displayDecimals)}
              </>
            )}
            {amountSecondary && (
              <>&nbsp;&nbsp;<Typography display="inline" variant="bodySmall">({typeof amountSecondary === 'string' ? amountSecondary : displayFullBN(amountSecondary, token.displayDecimals || 2)})</Typography></>
            )}
          </Typography>
        </Tooltip>
      ) : (
        <CircularProgress size={16} thickness={5} />
      )}
      {override === undefined ? (
        <Row gap={0.5}>
          {token.logo && (
            <TokenIcon
              token={token}
              css={{
                height: size === 'small' ? IconSize.xs : IconSize.small,
              }}
            />
          )}
          <Typography variant={size === 'small' ? 'bodySmall' : 'bodyMedium'} color="text.primary">
            {modifier && `${modifier} `}{token.symbol}
          </Typography>
        </Row>
      ) : <Box>{override}</Box>}
    </OutputField>
  );
};

export default TokenOutputField;
