import React from 'react';
import { StackProps, Typography, TypographyVariant } from '@mui/material';
import Row from '../Row';
import { FC } from '~/types';

const InfoRow: FC<
  {
    label: string | JSX.Element;
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
    {typeof label === 'string' ? (
      <Typography variant={labelVariant} color={labelColor}>
        {label}
      </Typography>
    ) : (
      label
    )}
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
