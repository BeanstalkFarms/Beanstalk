import { Card, CircularProgress, Container, Stack } from '@mui/material';
import React from 'react';
import PageHeaderSecondary from '../PageHeaderSecondary';

import { FC } from '~/types';

const GenericZero : FC<{
  title?: string;
  returnPath?: string;
  loading?: boolean;
}> = ({
  title,
  returnPath,
  loading = false,
  children
}) => (
  <Container maxWidth="sm">
    <Stack spacing={2}>
      <PageHeaderSecondary
        title={title}
        returnPath={returnPath}
      />
      <Card sx={{ textAlign: 'center', p: 2 }}>
        <Stack direction="column" gap={1} alignItems="center" justifyContent="center" minHeight={200}>
          {loading ? <CircularProgress color="primary" /> : null}
          {children}
        </Stack>
      </Card>
    </Stack>
  </Container>
);

export default GenericZero;
