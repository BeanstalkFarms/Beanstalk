import React from 'react';
import { Card, Stack, Typography } from '@mui/material';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

export type SelectorCardProps = {
  title: string;
  description: string;
  handleClick: any;
  recommendOption?: boolean;
}

const SelectorCard: FC<SelectorCardProps> = ({
  title,
  description,
  handleClick,
  recommendOption
}) => (
  <Card
    sx={{
        p: 2.5,
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: BeanstalkPalette.lightestBlue
        }
      }}
    onClick={handleClick}
    >
    <Stack justifyContent="center" alignItems="start" spacing={0.3}>
      <Row gap={0.3}>
        <Typography sx={{ fontSize: '20px' }}>{title}</Typography>
        {recommendOption && (
          <Typography sx={{ fontSize: '15px', color: BeanstalkPalette.logoGreen }}>
            (Recommended)
          </Typography>
        )}
      </Row>
      <Typography sx={{ fontSize: '14px' }} color="text.secondary">
        {description}
      </Typography>
    </Stack>
  </Card>
  );

export default SelectorCard;
