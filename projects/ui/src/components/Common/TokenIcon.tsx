import React from 'react';
import Token from '~/classes/Token';

import { FC } from '~/types';

const TokenIcon : FC<{
  token: Token;
  logoOverride?: string;
  css?: any;
}> = ({ token, logoOverride, ...props }) => (
  <img
    src={logoOverride || token.logo}
    alt={token.symbol}
    css={{
      height: '1em',
      width: 'auto'
    }}
    {...props}
  />
);

export default TokenIcon;
