import React from 'react';
import { StackProps, Typography, TypographyVariant } from '@mui/material';
import Row from '../Row';
import { FC } from '~/types';

const InfoRow: FC<
  {
    label: string;
    labelVariant?: TypographyVariant;
    infoVariant?: TypographyVariant;
    labelColor?: string;
    infoColor?: string;
  } & StackProps
> = ({
  children,
  label,
  labelVariant = 'body1',
  infoVariant = 'body1',
  labelColor = 'text.primary',
  infoColor = 'text.primary',
  ...props
}) => (
  <Row width="100%" justifyContent="space-between" {...props}>
    <Typography variant={labelVariant} color={labelColor}>
      {label}
    </Typography>
    {typeof children === 'string' ? (
      <Typography variant={infoVariant} color={infoColor}>
        {children}
      </Typography>
    ) : (
      children
    )}
  </Row>
);

export default InfoRow;
