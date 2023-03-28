import { Typography, Tooltip, Box } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import React from 'react';
import Row from '~/components/Common/Row';

export type RewardItemProps = {
  title: string;
  subTitle: JSX.Element;
  tooltip?: string;
  icon?: string;
  /** */
  // eslint-disable-next-line
  compact?: boolean;
}

const WellStat: React.FC<RewardItemProps> = ({
  subTitle,
  tooltip,
  title,
  icon,
}) => (
  <Box sx={{ flex: { lg: 'auto', xs: 1 } }}>
    <Tooltip title={tooltip || ''} placement="top">
      <Typography>
        {title}
        {tooltip && (
          <HelpOutlineIcon
            sx={{ display: 'inline', mb: 0.5, fontSize: '11px', color: 'text.tertiary' }}
          />
        )}
      </Typography>
    </Tooltip>
    <Row gap={0.4}>
      {icon && <img src={icon} alt="" height="16px" />}
      {subTitle && (subTitle)}
    </Row>
  </Box>
);

export default WellStat;
