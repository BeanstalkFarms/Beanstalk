import React from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { Alert, Box, IconButton, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import {
  RFF_BANNER_HEIGHT,
  RFF_BANNER_HEIGHT_MOBILE,
} from '~/hooks/app/usePageDimensions';
import useRffBannerVisibility from '~/hooks/app/useRffBannerVisibility';
import { FC } from '~/types';

type Props = {
  announcementUrl: string;
};

const RffIssueBanner: FC<Props> = ({ announcementUrl }) => {
  const { isVisible, dismiss } = useRffBannerVisibility();

  const handleDismiss = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dismiss();
  };

  if (!isVisible) return null;

  return (
    <Box
      sx={{
        position: 'relative',
      }}
    >
      <Alert
        severity="warning"
        icon={false}
        aria-label="RFF liquidity migration notice"
        sx={{
          position: 'relative',
          minHeight: {
            xs: RFF_BANNER_HEIGHT_MOBILE,
            sm: RFF_BANNER_HEIGHT,
          },
          alignItems: 'center',
          borderRadius: 0,
          border: 0,
          borderBottom: '1px solid',
          borderColor: 'warning.main',
          bgcolor: '#fff7df',
          px: { xs: 5, sm: 5 },
          py: 0.5,
          '& .MuiAlert-message': { width: '100%', py: 0 },
        }}
      >
        <Box
          component={RouterLink}
          to="/swap"
          aria-label="Open Swap and Request a Fill"
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: -2,
            },
          }}
        />
        <Stack
          gap={0.25}
          alignItems="center"
          textAlign="center"
          sx={{ position: 'relative', zIndex: 2, pointerEvents: 'none' }}
        >
          <Typography
            color="text.secondary"
            lineHeight={1.3}
            sx={{ fontSize: { xs: 12, sm: 13 } }}
          >
            The BCM elected to migrate the majority of the liquidity owned by
            Beanstalk into a custodial multisig to protect against a potential
            exploit facilitated by rapidly accelerating AI models.
          </Typography>
          <Typography
            color="text.secondary"
            lineHeight={1.3}
            sx={{ fontSize: { xs: 12, sm: 13 } }}
          >
            Users can elect to swap with the full reserves by submitting a
            Request For Fill (RFF).{' '}
            {announcementUrl ? (
              <Link
                href={announcementUrl}
                target="_blank"
                rel="noreferrer"
                color="inherit"
                fontWeight="fontWeightBold"
                sx={{ pointerEvents: 'auto' }}
              >
                Read more about it here
              </Link>
            ) : (
              'Read more about it here'
            )}
            .
          </Typography>
        </Stack>
        <IconButton
          aria-label="Dismiss liquidity notice"
          size="small"
          onClick={handleDismiss}
          onKeyDown={(event) => event.stopPropagation()}
          sx={{
            position: 'absolute',
            right: { xs: 8, sm: 12 },
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'text.secondary',
            zIndex: 3,
          }}
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Alert>
    </Box>
  );
};

export default RffIssueBanner;
