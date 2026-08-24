import React from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { IconButton, Link, Stack, Tooltip, Typography } from '@mui/material';

type InfoProps = {
  announcementUrl: string;
  safeAddress?: string;
};

const RffRequestInfo: React.FC<InfoProps> = ({
  announcementUrl,
  safeAddress,
}) => (
  <Typography color="text.secondary">
    Submit an intent to swap Bean ↔ wstETH, utilizing the full reserves held by
    the{' '}
    {safeAddress ? (
      <Link
        href={`https://app.safe.global/home?safe=arb1:${safeAddress}`}
        target="_blank"
        rel="noreferrer"
        color="primary"
        fontWeight="fontWeightBold"
      >
        RFF Multisig
      </Link>
    ) : (
      'RFF Multisig'
    )}
    .{' '}
    {announcementUrl ? (
      <Link
        href={announcementUrl}
        target="_blank"
        rel="noreferrer"
        color="primary"
        fontWeight="fontWeightBold"
      >
        See EBIP →
      </Link>
    ) : null}
  </Typography>
);

export const RffMinimumReceivedLabel: React.FC = () => (
  <Stack direction="row" alignItems="center" gap={0.25}>
    <Typography color="text.secondary">Minimum received</Typography>
    <Tooltip
      arrow
      title="The RFF will execute the swap using the minimum of: 1) the requested RFF amount, 2) the approved amount, and 3) the user’s total selected balance at the time of fill."
    >
      <IconButton
        size="small"
        aria-label="How the fill amount is determined"
        sx={{ p: 0.25, color: 'text.secondary' }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  </Stack>
);

export default RffRequestInfo;
