import React from 'react';
import { Button, DialogProps, Link, Stack, Typography } from '@mui/material';
import { StyledDialog, StyledDialogTitle, StyledDialogContent } from '~/components/Common/Dialog';
import { GuideProps } from '~/components/Common/Guide/GuideButton';

import { FC } from '~/types';

const GuideDialog: FC<DialogProps & GuideProps> = (props) => (
  <StyledDialog onClose={props.onClose} open={props.open} fullWidth>
    <StyledDialogTitle onClose={props.onClose as any}>{props.title}</StyledDialogTitle>
    <StyledDialogContent>
      <Stack gap={1}>
        {props.guides.map((guide) => (
          <Button
            key={guide.url}
            component={Link}
            href={guide.url}
            variant="outlined"
            color="secondary"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              py: 2,
              display: 'block',
              color: 'inherit',
              borderColor: 'divider',
              height: 'auto',
              textAlign: 'center',
              '&:hover': {
                borderColor: 'primary.main'
              }
            }}
          >
            <Typography variant="body1">{guide.title}</Typography>
          </Button>
        ))}
      </Stack>
    </StyledDialogContent>
  </StyledDialog>
);

export default GuideDialog;
