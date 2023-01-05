import React, { useMemo } from 'react';
import {
  Box,
  Stack,
  Theme,
  ThemeProvider,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import { useAtomValue } from 'jotai';
import useNavHeight from '~/hooks/app/usePageDimensions';
import useBanner from '~/hooks/app/useBanner';
import MarketActions from '~/components/Market/PodsV2/Modules/MarketActions';
import MarketActivityTable from '~/components/Market/PodsV2/Modules/MarketTables';
import MarketGraphContainer from '~/components/Market/PodsV2/Modules/MarketGraphContainer';
import { muiThemeCondensed } from '~/components/App/muiTheme';
import { marketBottomTabsHeightAtom } from '~/components/Market/PodsV2/info/atom-context';

const SECTION_MAX_WIDTH = 375;
const GAP = 0.8;
const SPACING_SIZE = GAP * 10;
const LEFT_MAX_WIDTH = `calc(100% - ${SECTION_MAX_WIDTH}px - ${SPACING_SIZE}px)`;

const marketActionsV2Sx = (theme: Theme) => ({
  [theme.breakpoints.up('lg')]: {
    position: 'absolute',
    height: '100%',
    top: 0,
    right: 0,
    width: SECTION_MAX_WIDTH,
  }
});

const MarketPage: React.FC<{}> = () => {
  // helpers
  const banner = useBanner();
  const navHeight = useNavHeight(!!banner);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const bottomTabsHeight = useAtomValue(marketBottomTabsHeightAtom);

  const chartHeight = useMemo(() => {
    const bottomHeight = navHeight + 35;
    if (isMobile) return '400px';
    return `calc(100vh - ${GAP * 10 + bottomHeight + bottomTabsHeight + 57}px)`;
  }, [navHeight, bottomTabsHeight, isMobile]);

  return (
    <Box p={1}>
      <Stack sx={{ position: 'relative' }} gap={1}>
        <Stack gap={1}>
          <Box sx={{ width: { xs: '100%', lg: LEFT_MAX_WIDTH } }}>
            <MarketGraphContainer chartHeight={chartHeight} />
          </Box>
          <Box sx={marketActionsV2Sx}>
            <MarketActions />
          </Box>
          <Box sx={{ width: { xs: '100%', lg: LEFT_MAX_WIDTH } }}>
            <MarketActivityTable />
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
};

const PodMarketV2: React.FC<{}> = () => (
  <ThemeProvider theme={muiThemeCondensed}>
    <MarketPage />
  </ThemeProvider>
);

export default PodMarketV2;
