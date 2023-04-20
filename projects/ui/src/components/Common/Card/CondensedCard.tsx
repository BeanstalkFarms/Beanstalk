import React from 'react';
import { Card, CardProps, Typography } from '@mui/material';
import Row from '../Row';

type ICondensedCard = {
  children: React.ReactNode;
  title: string | JSX.Element;
  actions?: JSX.Element;
} & Omit<CardProps, 'title'>;

/**
 * designed to be used in context of the condensed MUI theme
 */
const CondensedCard: React.FC<ICondensedCard> = ({
  title,
  children,
  actions,
  ...cardProps
}) => (
  <Card {...cardProps}>
    <Row justifyContent="space-between" width="100%" p={1}>
      {typeof title === 'string' ? (
        <Typography variant="headerSmall" p={0.5}>
          {title}
        </Typography>
      ) : (
        title
      )}
      {actions}
    </Row>
    {children}
  </Card>
);

export default CondensedCard;
