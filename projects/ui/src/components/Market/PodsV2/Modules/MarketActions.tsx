import { Box, Card, Stack, Tab, Tabs } from '@mui/material';
import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FontSize } from '~/components/App/muiTheme';

const tabSx = {
  '&.MuiTab-root': {
    fontSize: FontSize.sm,
    '&.Mui-selected': {
      fontSize: FontSize.sm,
    },
  },
};

const MarketActions: React.FC<{}> = () => {
  const location = useLocation();
  const action = useMemo(
    () => location.pathname.split('/')[2],
    [location.pathname]
  );

  return (
    <Card
      sx={{
        width: '100%',
        overflow: 'auto',
        position: 'relative',
        maxHeight: { xs: '100%', lg: '78vh' },
      }}
    >
      <Box
        sx={{
          px: 1.2,
          py: 1.2,
          borderBottom: '0.5px solid',
          borderColor: 'divider',
        }}
      >
        <Tabs value={!action || action === 'buy' ? 0 : 1}>
          <Tab component={NavLink} to="/market/buy" label="BUY" sx={tabSx} />
          <Tab component={NavLink} to="/market/sell" label="SELL" sx={tabSx} />
        </Tabs>
      </Box>
      <Stack sx={{ width: '100%' }}>
        {/* Will contain sub-actions and their respective forms */}
        <Outlet />
      </Stack>
    </Card>
  );
};

export default MarketActions;
