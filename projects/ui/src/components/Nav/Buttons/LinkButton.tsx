import React from 'react';
import {
  Box,
  Button, Stack,
  Typography,
} from '@mui/material';
import {
  Link as RouterLink,
  useMatch,
  useResolvedPath,
} from 'react-router-dom';

/**
 * 
 */
import { FC } from '~/types';

const LinkButton: FC<{ to: string; title: string, tag?: string }> = ({ to, title, tag }) => {
  const resolved = useResolvedPath(to);
  const match    = useMatch({
    path: resolved.pathname,
    // require exact match for the index page
    // otherwise, use prefix match
    // this keeps the Market tab highlighted even when you click into an order
    end: to === '/'
  });
  
  return (
    <Stack sx={{
      // Set a default transparent bottom border.
      // Switch to green when selected.
      borderBottom: 3,
      borderColor: 'transparent',
      borderBottomColor: match ? 'primary.main' : 'transparent',
      // Pull the button down slightly so that it overlaps the Nav's
      // bottom blue border.
      mb: '-1.5px',
      height: '100%',
      justifyContent: 'center',
    }}>
      <Button
        disableRipple
        component={RouterLink}
        to={to}
        size="small"
        variant="text"
        sx={{
          color: match ? 'primary.main' : 'text.primary',
          '&:hover > h6': {
            textDecorationThickness: '2px',
          },
          minWidth: 0,
          px: 1.5,
          display: 'inline-flex',
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            display: 'inline-block',
            textDecorationThickness: '2px',
          }}
        >
          {title}
        </Typography>
        {tag && (
          <Box sx={{
            textDecoration: 'none !important',
            display: 'inline-block',
            ml: 0.5,
            backgroundColor: 'rgba(255,255,255,.9)',
            px: 1,
            py: 0.1,
            borderRadius: 1,
            fontSize: '0.7em',
          }}>
            {tag}
          </Box>
        )}
      </Button>
    </Stack>
  );
};

export default LinkButton;
