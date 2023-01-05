import React from 'react';
import { Button, ButtonProps as MuiButtonProps, Card, LinkProps, Stack, Typography } from '@mui/material';
import { BeanPoolState } from '~/state/bean/pools';
import { displayBeanPrice, displayBN } from '~/util';
import { Pool } from '~/classes';
import TokenIcon from '~/components/Common/TokenIcon';
import { ZERO_BN } from '~/constants';
import Row from '~/components/Common/Row';

/**
 * Displays data about a Pool containing Beans and other assets.
 */
import { FC } from '~/types';

const PoolCard: FC<{
  pool: Pool;
  poolState: BeanPoolState;
  ButtonProps?: MuiButtonProps & LinkProps;
}> = ({
  pool,
  poolState,
  ButtonProps,
}) => {
  const cardContent = (
    <Row justifyContent="space-between">
      <Row alignItems="center" gap={1.0}>
        <Row spacing={0.25} sx={{ fontSize: 24 }}>
          {pool.tokens.map((token) => (
            <TokenIcon key={token.address} token={token} />
          ))}
        </Row>
        <Typography sx={{ fontWeight: 600, pt: 0.2 }}>
          ${displayBeanPrice(poolState?.price || ZERO_BN, 4)}
        </Typography>
      </Row>
      <Stack>
        <Row justifyContent="end" gap={0.6}>
          <Typography color="text.tertiary" variant="bodySmall">
            liquidity:
          </Typography>
          <Typography variant="bodySmall">
            ${displayBN(poolState?.liquidity || ZERO_BN)}
          </Typography>
        </Row>
        <Row justifyContent="end" gap={0.6}>
          <Typography color="text.tertiary" variant="bodySmall">
            deltaB:
          </Typography>
          <Row gap={0.25}>
            <Typography variant="bodySmall">
              {poolState?.deltaB?.gte(0) ? '+' : ''}
              {displayBN(poolState?.deltaB || ZERO_BN, true)}
            </Typography>
          </Row>
        </Row>
      </Stack>
    </Row>
  );
  
  return ButtonProps ? (
    <Button
      variant="outlined-secondary"
      color="secondary"
      sx={{
        borderWidth: 0.5,
        height: 'auto', // FIXME
        display: 'block',
      }}
      {...ButtonProps}
    >
      {cardContent}
    </Button>
  ) : (
    <Card sx={{ p: 1, pr: 2, pl: 2, background: 'secondary.main' }}>
      {cardContent}
    </Card>
  );
};

export default PoolCard;
