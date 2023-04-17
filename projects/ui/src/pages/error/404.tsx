import React from 'react';
import {
  Box,
  Card,
  Container,
  Stack, Typography
} from '@mui/material';
import forecast from '~/img/beanstalk/forecast-banner.svg';

import { FC } from '~/types';

const PageNotFound: FC<{}> = () => (
  <Container maxWidth="md">
    <Card sx={{ px: 4, py: 6 }}>
      <Stack direction="column" alignItems="center" justifyContent="center" gap={1}>
        <Box
          component="img"
          src={forecast}
          alt="Barn"
          sx={{ maxWidth: 400, marginBottom: 20 }}
        />
        <Typography variant="h1">404 error</Typography>
        <Typography color="text.secondary" variant="h3">The page you are looking for does not exist!</Typography>
      </Stack>
    </Card>
  </Container>
);

export default PageNotFound;
