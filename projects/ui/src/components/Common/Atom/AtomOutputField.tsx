import { StackProps, Typography, TypographyVariant } from '@mui/material';
import BigNumber from 'bignumber.js';
import { PrimitiveAtom, useAtomValue } from 'jotai';
import React from 'react';
import Row from '~/components/Common/Row';
import { ZERO_BN } from '~/constants';
import { displayFullBN } from '~/util';

const AtomOutputField: React.FC<
  {
    atom: PrimitiveAtom<BigNumber | null>;
    label?: string;
    info?: string;
    variant?: TypographyVariant;
    disabled?: boolean;
    formatValue?: (...props: any | any[]) => string;
  } & StackProps
> = ({
  atom: _atom,
  label,
  info,
  variant = 'caption',
  disabled,
  formatValue,
  ...stackProps
}) => {
  const value = useAtomValue(_atom);

  return (
    <Row
      width="100%"
      justifyContent="space-between"
      {...stackProps}
      sx={{
        px: '8px',
        py: '12px',
        borderRadius: 0.6,
        border: '0.5px solid',
        borderColor: 'rgba(0, 0, 0, 0.23)',
        ...stackProps.sx,
      }}
    >
      <Typography variant={variant} color="text.primary">
        {label}
      </Typography>
      <Typography
        variant={variant}
        color={disabled ? 'text.tertiary' : 'text.primary'}
        textAlign="right"
      >
        {`${
          formatValue ? formatValue(value) : displayFullBN(value || ZERO_BN, 2)
        } ${info || ''}`}
      </Typography>
    </Row>
  );
};

export default AtomOutputField;
