import { Tab, TabProps } from '@mui/material';
import React from 'react';
import Dot from '~/components/Common/Dot';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

const BadgeTab : FC<TabProps & { showBadge: boolean }> = ({ showBadge, label, sx, ...props }) => (
  <Tab
    label={(
      <Row display="inline-flex" gap={0.25}>
        {showBadge && <Dot color="primary.main" className="B-badge" sx={{ opacity: 0.7 }} />}
        <span>{label}</span>
      </Row>
    )}
    sx={{
      overflow: 'visible',
      /// Show the badge in full color when selected.
      '&.Mui-selected .B-badge': {
        opacity: 1,
      },
      ...sx
    }}
    {...props}
  />
);

export default BadgeTab;
