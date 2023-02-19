import React from 'react';
import {
  Box,
  CardProps,
  CircularProgress,
  Stack,
  StackProps,
  Tooltip,
  Typography,
} from '@mui/material';
import BigNumber from 'bignumber.js';
import { Token } from '@beanstalk/sdk';
import { Token as TokenOld } from '~/classes';
import { displayFullBN } from '~/util';
import EmbeddedCard from '../EmbeddedCard';
import Row from '../Row';
import TokenIcon from '../TokenIcon';
import InfoRow from './InfoRow';

export type TokenOutputRowProps = {
  /** */
  token: TokenOld | Token;
  /** the 'amount' of token */
  amount: BigNumber;
  /** The $ value (or other derived value) of the `amount` */
  amountSecondary?: string | BigNumber;
  /** Annotate the token with some modifier ("Claimable", "Harvestable") */
  labelModifier?: string;
  /** Display a loading spinner */
  isLoading?: boolean;
  /** */
  amountTooltip?: string | JSX.Element;
  /** Override the end adornment section */
  override?: any;
  /** disable +/- prefix */
  disablePrefix?: boolean;
};

export const TokenOutputsFieldRow: React.FC<TokenOutputRowProps & StackProps> = ({
  token,
  amount,
  amountSecondary,
  labelModifier = '',
  isLoading = false,
  amountTooltip,
  override = undefined,
  disablePrefix,
  ...stackProps
}) => {
  const isZero = amount.eq(0);
  const isNegative = amount.lt(0);
  const prefix = isZero || disablePrefix ? '' : isNegative ? '-' : '+';

  return (
    <InfoRow
      {...stackProps}
      label={
        override ? (
          <Box>{override}</Box>
        ) : (
          <Row gap={0.5}>
            {token.logo && <TokenIcon token={token} />}
            <Typography component="span" variant="subtitle1" color="text.primary">
              {labelModifier && `${labelModifier} `}
              {token.symbol}
            </Typography>
          </Row>
        )
      }
    >
      {isLoading ? (
        <CircularProgress size={16} thickness={5} />
      ) : (
        <Tooltip title={amountTooltip}>
          <Stack>
            <Typography
              variant="subtitle1"
              sx={{ 
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' }, 
                color: isZero || disablePrefix ? 'text.secondary' : isNegative ? 'error.main' : 'primary.main'
              }}
            >
              {amountSecondary ? (
                <Typography display="inline" variant="body1" component="span" color="text.secondary">
                  <>
                    ({typeof amountSecondary === 'string' 
                      ? amountSecondary 
                      : displayFullBN(amountSecondary, token.displayDecimals || 2)})
                    &nbsp;
                  </>
                </Typography>
              ) : null}
              {amount.abs().gt(new BigNumber(1000000)) ? (
                <>{prefix}{displayFullBN(amount.abs(), 0)}</>
              ) : (
                <>{prefix}{displayFullBN(amount.abs(), token.displayDecimals)}</>
              )}
            </Typography>
          </Stack>
        </Tooltip>
      )}
    </InfoRow>
  );
};

export type TokenOutputsFieldProps = {
  groups: {
    title?: string;
    data: TokenOutputRowProps[];
  }[]
};

const TokenOutputsField: React.FC<TokenOutputsFieldProps & CardProps> = ({ groups, ...cardProps }) => {
  if (!groups.length) return null;

  return (
    <EmbeddedCard {...cardProps} sx={{ p: 2, borderRadius: 1 }}>
      <Stack width="100%" gap={1.5}>
        {groups.map(({ title, data }, i) => (
          <Stack width="100%" gap={0.5} key={`${i}-token-output`}>
            {title ? (
              <Typography variant="subtitle1" color="text.primary">
                {title}
              </Typography>
            ) : null}
            <Stack width="100%" gap={1}>
              {data.map((datum, k) => (
                <TokenOutputsFieldRow 
                  key={datum.token.symbol || k} 
                  {...datum}
                />
              ))}
            </Stack>
          </Stack>
        ))}
      </Stack>
    </EmbeddedCard>
  );
};

export default TokenOutputsField;
