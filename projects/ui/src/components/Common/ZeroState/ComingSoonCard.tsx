import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, Card, Stack, Typography } from '@mui/material';
import forecast from '~/img/beanstalk/forecast-banner.svg';

import { FC } from '~/types';

const ComingSoonCard : FC<{ title: string }> = ({ title }) => (
  <Card sx={{ px: 4, py: 6 }}>
    <Stack direction="column" alignItems="center" justifyContent="center" gap={4}>
      <img
        src={forecast}
        alt="Barn"
        css={{ maxWidth: 400 }}
      />
      <Typography variant="h1">The {title} page is coming soon</Typography>
      <Stack direction="column" gap={2}>
        <Button
          component={RouterLink}
          to="/"
          color="primary"
          variant="outlined"
          size="large"
          sx={{ px: 4 }}
          >
          Support the Barn Raise
        </Button>
      </Stack>
    </Stack>
  </Card>
);

export default ComingSoonCard;
