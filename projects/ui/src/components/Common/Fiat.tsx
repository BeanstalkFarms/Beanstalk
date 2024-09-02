import React from 'react';
import BigNumber from 'bignumber.js';
import { Box } from '@mui/material';
import logo from '~/img/tokens/bean-logo.svg';
import { TokenValue } from '@beanstalk/sdk';
import useSiloTokenToFiat from '~/hooks/beanstalk/useSiloTokenToFiat';
import useSetting from '~/hooks/app/useSetting';
import usePrice from '~/hooks/beanstalk/usePrice';
import { displayBN, displayFullBN } from '~/util';
import { ZERO_BN } from '~/constants';
import Row from '~/components/Common/Row';

import { FC } from '~/types';
import { TokenInstance } from '~/hooks/beanstalk/useTokens';

const Fiat: FC<{
  /* The USD value of `amount`. If provided, we don't try to derive via `siloTokenToFiat`. */
  value?: BigNumber | TokenValue;
  token?: TokenInstance;
  amount: BigNumber | TokenValue | undefined;
  allowNegative?: boolean;
  chop?: boolean;
  truncate?: boolean;
  defaultDisplay?: string;
}> = ({
  value: __value,
  token,
  amount: _amount,
  allowNegative = false,
  chop = true,
  truncate = false,
  defaultDisplay = '?',
}) => {
  const [denomination] = useSetting('denomination');
  const price = usePrice();
  const siloTokenToFiat = useSiloTokenToFiat();
  const amount =
    _amount instanceof TokenValue ? new BigNumber(_amount.toHuman()) : _amount;
  const _value =
    __value instanceof TokenValue ? new BigNumber(__value.toHuman()) : __value;
  const value = _value
    ? // value override provided (in USD terms)
      denomination === 'usd'
      ? _value
      : _value.div(price)
    : // derive value from token amount
      amount && token
      ? siloTokenToFiat(token, amount, denomination, chop)
      : ZERO_BN;
  const displayValue = truncate
    ? displayBN(value, allowNegative)
    : displayFullBN(value, 2, 2);

  return (
    <Row
      component="span"
      display="inline-flex"
      sx={{ verticalAlign: 'top', position: 'relative' }}
    >
      {denomination === 'bdv' ? (
        <>
          <Box
            component="img"
            src={logo}
            alt="BEAN"
            sx={{
              height: '1em',
              marginRight: '0.25em',
              display: 'inline',
              position: 'relative',
              top: 0,
              left: 0,
            }}
          />
          <span>{displayValue}</span>
        </>
      ) : price?.gt(0) ? (
        <>
          <span>$</span>
          <span>{displayValue}</span>
        </>
      ) : (
        <span>{defaultDisplay}</span>
      )}
    </Row>
  );
};

export default Fiat;
