import React from 'react';
import { Stack, Tooltip, Typography, useMediaQuery } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useTheme } from '@mui/material/styles';
import BigNumber from 'bignumber.js';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import greenBeanIcon from '~/img/tokens/bean-logo-circled.svg';
import { Token } from '~/classes';
import { displayFullBN } from '../../../util';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

const UnripeTokenRow: FC<{
  name: string;
  amount: BigNumber;
  bdv?: BigNumber;
  tooltip: string | React.ReactElement;
  token: Token;
}> = ({
  name,
  amount,
  bdv,
  tooltip,
  token,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const primaryColor = amount.eq(0) ? 'text.tertiary' : null;
  return (
    <Row justifyContent="space-between" alignItems="start">
      <Row gap={0.4}>
        {amount.gt(0) ? (
          <CheckIcon sx={{ fontSize: 16, color: BeanstalkPalette.logoGreen }} />
        ) : (
          <CloseIcon sx={{ fontSize: 16, color: 'text.tertiary' }} />
        )}
        <Typography
          sx={{
            color: primaryColor,
            textTransform: 'capitalize'
          }}
        >
          {name}
        </Typography>
        {!isMobile && (
          <Tooltip placement="right" title={tooltip}>
            <HelpOutlineIcon
              sx={{ color: 'text.tertiary', fontSize: '13px' }}
            />
          </Tooltip>
        )}
      </Row>
      <Stack direction={isMobile ? 'column' : 'row'} alignItems="center" gap={0.3}>
        {(amount && bdv) ? (
          // LP states
          <Stack direction={isMobile ? 'column' : 'row'} sx={{ alignItems: isMobile ? 'end' : null }} gap={0.5}>
            <Row gap={0.3}>
              <img src={token.logo} alt="Circulating Beans" height={13} />
              <Typography sx={{ color: primaryColor }}>
                {displayFullBN(amount)}
              </Typography>
            </Row>
            <Row gap={0.3}>
              <Typography sx={{ color: primaryColor }}>
                (
              </Typography>
              <img src={greenBeanIcon} alt="Circulating Beans" width={13} />
              <Typography sx={{ color: primaryColor }}>
                {displayFullBN(bdv)}
                )
              </Typography>
            </Row>
          </Stack>
        ) : (
          // Bean states
          <Row gap={0.3}>
            <img src={greenBeanIcon} alt="Circulating Beans" width={13} />
            <Typography sx={{
              fontSize: '16px',
              color: amount.eq(0) ? 'text.secondary' : null
            }}>
              {displayFullBN(amount)}
            </Typography>
          </Row>
        )}
      </Stack>
    </Row>
  );
};

export default UnripeTokenRow;
