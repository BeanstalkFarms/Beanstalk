import React from 'react';
import { Stack, Tab, Tabs } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { useAtom, useAtomValue } from 'jotai';

import useTabs from '~/hooks/display/useTabs';

import { FontSize, FontWeight } from '~/components/App/muiTheme';
import Row from '~/components/Common/Row';
import {
  marketBottomTabsAtom,
  marketBottomTabsHeightAtom,
} from '../info/atom-context';
import DropdownIcon from '~/components/Common/DropdownIcon';
import MarketActivityTable from '../Tables/MarketActivity';
import FarmerMarketActivityTable from '../Tables/FarmerOrders';
import CondensedCard from '~/components/Common/Card/CondensedCard';
import AllActiveListings from '../Tables/AllActiveListings';
import AllActiveOrders from '../Tables/AllActiveOrders';
import useMarketActivityData from '~/hooks/beanstalk/useMarketActivityData';
import useFarmerMarket from '~/hooks/farmer/market/useFarmerMarket2';
import useMarketData from '~/hooks/beanstalk/useMarketData';

const sx = {
  tabs: {
    '&.MuiTab-root': {
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      lineHeight: FontSize.sm,
      '&.Mui-selected': {
        fontSize: FontSize.sm,
      },
    },
  },
  icons: {
    ':hover': { cursor: 'pointer' },
  },
};

const MarketTables: React.FC<{}> = () => {
  // STATE
  const [openState, setOpenState] = useAtom(marketBottomTabsAtom);
  const [tab, setTab] = useTabs();

  // HELPERS
  const size = useAtomValue(marketBottomTabsHeightAtom);

  // DATA
  // pull queries out of their respecitive hooks to avoid re-fetching
  const marketData = useMarketData(); // "BUY NOW" and "SELL NOW"
  const { data: farmerMarket } = useFarmerMarket(); // "YOUR ORDERS"
  const { data: eventsData, harvestableIndex, fetchMoreData } = useMarketActivityData(); // "MARKET ACTIVITY"

  // FUNCTIONS
  const openIfClosed = () => {
    if (openState === 0) {
      setOpenState(1);
    }
  };

  return (
    <Stack
      sx={{ 
        bottom: 0, 
        height: openState !== 0 ? `${size}px` : undefined 
      }}
    >
      <CondensedCard
        sx={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          
        }}
        title={
          <Tabs value={tab} onChange={setTab}>
            <Tab label="BUY NOW" sx={sx.tabs} onClick={openIfClosed} />
            <Tab label="SELL NOW" sx={sx.tabs} onClick={openIfClosed} />
            <Tab label="YOUR ORDERS" sx={sx.tabs} onClick={openIfClosed} />
            <Tab label="MARKET ACTIVITY" sx={sx.tabs} onClick={openIfClosed} />
          </Tabs>
        }
        actions={
          <Row alignItems="center">
            <Stack
              onClick={() => {
                (openState === 0 || openState === 2) && setOpenState(1);
                openState === 1 && setOpenState(0);
              }}
              sx={sx.icons}
            >
              <DropdownIcon 
                open={openState !== 0} 
              />
            </Stack>
            <Stack display={{ xs: 'none', md: 'flex' }}>
              {openState === 1 && (
                <FullscreenIcon 
                  onClick={() => setOpenState(2)} 
                  sx={sx.icons} 
                />
              )}
              {openState === 2 && (
                <FullscreenExitIcon 
                  onClick={() => setOpenState(1)} 
                  sx={sx.icons} 
                />
              )}
            </Stack>
          </Row>
        }
      >
        <Stack sx={{ flex: 1, height: '100%' }}>
          {openState !== 0 && tab === 0 && (
            <AllActiveListings data={marketData} />
          )}
          {openState !== 0 && tab === 1 && (
            <AllActiveOrders data={marketData} />
          )}
          {openState !== 0 && tab === 2 && (
            <FarmerMarketActivityTable
              data={farmerMarket}
              initializing={!farmerMarket.length || harvestableIndex.lte(0)}
            />
          )}
          {openState !== 0 && tab === 3 && (
            <MarketActivityTable
              data={eventsData}
              fetchMoreData={fetchMoreData}
              initializing={!eventsData.length || harvestableIndex.lte(0)}
            />
          )}
        </Stack>
      </CondensedCard>
    </Stack>
  );
};

export default MarketTables;
