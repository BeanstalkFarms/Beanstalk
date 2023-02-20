import { Token } from '@beanstalk/sdk';
import { CardProps, Stack, Tooltip, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import React from 'react';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { FontSize } from '~/components/App/muiTheme';
import { displayFullBN } from '~/util';
import EmbeddedCard from '../EmbeddedCard';
import Row from '../Row';
import TokenIcon from '../TokenIcon';

export type TxnOutputFieldProps = {
  items: {
    primary: {
      token: Token;
      title: string;
      amount: BigNumber;
      amountTooltip?: string | JSX.Element;
    };
    secondary?: {
      title: string | JSX.Element;
      amount?: BigNumber;
      tooltip?: string;
      suffix?: string;
    };
  }[];
};

const TxnOutputField: React.FC<TxnOutputFieldProps & CardProps> = ({
  items,
  ...cardProps
}) => {
  const getPrefix = (amount: BigNumber) => (amount.lt(0) ? '-' : '+');

  return (
    <EmbeddedCard {...cardProps} sx={{ p: 2, borderRadius: 1 }}>
      <Stack width="100%" gap={1.5}>
        {items.map((item, i) => {
          const { title, token, amount } = item.primary;
          return (
            <Stack width="100%" key={`${title}-${i}`}>
              <Row width="100%" alignItems="flex-start" gap={1}>
                <Stack width="100%">
                  <Row width="100%" justifyContent="space-between">
                    <Typography variant="subtitle1" color="text.secondary">
                      <Row gap={1}>
                        <TokenIcon token={token} css={{ fontSize: FontSize.lg }} />
                        {title}
                      </Row>
                    </Typography>
                    <Tooltip title={item.primary.amountTooltip || ''}>
                      <Typography variant="subtitle1" color="text.secondary">
                        {amount.abs().gt(new BigNumber(1000000)) ? (
                          <>
                            {getPrefix(amount)}
                            {displayFullBN(amount.abs(), 0)}
                          </>
                      ) : (
                        <>
                          {getPrefix(amount)}
                          {displayFullBN(amount.abs(), token.displayDecimals)}
                        </>
                      )}
                      </Typography>
                    </Tooltip>
                  </Row>
                  {item.secondary && (
                    <Row width="100%" justifyContent="space-between" pl={3}>
                      <Typography variant="bodySmall" color="text.secondary">
                        {item.secondary.title}
                        {item.secondary.tooltip ? (
                          <Tooltip title={item.secondary.tooltip || ''}>
                            <HelpOutlineIcon
                              sx={{
                                ml: 0.1,
                                color: 'text.secondary',
                                display: 'inline',
                                mb: 0.5,
                                fontSize: '11px',
                              }}
                            />
                          </Tooltip>
                        ) : null}
                      </Typography>
                      {item.secondary.amount ? (
                        <Typography variant="caption" color="text.tertiary">
                          {amount.abs().gt(new BigNumber(1000000)) ? (
                            <>
                              {getPrefix(item.secondary.amount)}
                              {displayFullBN(amount.abs(), 0)}
                              {item.secondary.suffix || ''}
                            </>
                          ) : (
                            <>
                              {getPrefix(item.secondary.amount)}
                              {displayFullBN(
                                amount.abs(),
                                token.displayDecimals
                              )}
                              {item.secondary.suffix || ''}
                            </>
                          )}
                        </Typography>
                      ) : null}
                    </Row>
                  )}
                </Stack>
              </Row>
              <Row width="100%" justifyContent="space-between">
                <Typography />
              </Row>
            </Stack>
          );
        })}
      </Stack>
    </EmbeddedCard>
  );
};

export default TxnOutputField;
