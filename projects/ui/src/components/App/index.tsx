import React from 'react';

import { Box, Stack } from '@mui/material';
import BigNumber from 'bignumber.js';
import { ToastBar, Toaster } from 'react-hot-toast';
import { Navigate, Route, Routes } from 'react-router-dom';

import NewProposalsDialog from '~/components/Governance/NewProposalsDialog';
import NavBar from '~/components/Nav/NavBar';

import AppUpdater from '~/state/app/updater';
import PoolsUpdater from '~/state/bean/pools/updater';
import UnripeUpdater from '~/state/bean/unripe/updater';
import BarnUpdater from '~/state/beanstalk/barn/updater';
import FieldUpdater from '~/state/beanstalk/field/updater';
import SiloUpdater from '~/state/beanstalk/silo/updater';
import SunUpdater from '~/state/beanstalk/sun/updater';
import FarmerBalancesUpdater from '~/state/farmer/balances/updater';
import FarmerBarnUpdater from '~/state/farmer/barn/updater';
import FarmerFieldUpdater from '~/state/farmer/field/updater';
import FarmerMarketUpdater from '~/state/farmer/market/updater';
import FarmerSiloUpdater from '~/state/farmer/silo/updater';

import AnalyticsPage from '~/pages/analytics';
import BalancesPage from '~/pages/balances';
import Barn from '~/pages/barn';
import ChopPage from '~/pages/chop';
import PageNotFound from '~/pages/error/404';
import FieldPage from '~/pages/field';
import ForecastPage from '~/pages/forecast';
import GovernancePage from '~/pages/governance';
import ProposalPage from '~/pages/governance/proposal';
import FarmerDelegatePage from '~/pages/governance/delegate';
import TransactionHistoryPage from '~/pages/history';
import NFTPage from '~/pages/nft';
import SiloPage from '~/pages/silo';
import SiloTokenPage from '~/pages/silo/token';
import SwapPage from '~/pages/swap';
import GovernanceUpdater from '~/state/beanstalk/governance/updater';

import useBanner from '~/hooks/app/useBanner';
import useNavHeight from '~/hooks/app/usePageDimensions';

import pageBackground from '~/img/beanstalk/interface/bg/spring.png';

import EnforceNetwork from '~/components/App/EnforceNetwork';
import useAccount from '~/hooks/ledger/useAccount';
import './App.css';
import 'react-day-picker/dist/style.css';

import { FC } from '~/types';

import PodMarketPage from '~/pages/market/pods';
import PodMarketBuy from '~/components/Market/PodsV2/Actions/Buy';
import PodMarketCreateOrder from '~/components/Market/PodsV2/Actions/Buy/CreateOrder';
import PodMarketFillListing from '~/components/Market/PodsV2/Actions/Buy/FillListing';
import PodMarketSell from '~/components/Market/PodsV2/Actions/Sell';
import PodMarketCreateListing from '~/components/Market/PodsV2/Actions/Sell/CreateListing';
import PodMarketFillOrder from '~/components/Market/PodsV2/Actions/Sell/FillOrder';
import FarmerDelegationsUpdater from '~/state/farmer/delegations/updater';
import VotingPowerPage from '~/pages/governance/votingPower';
import MorningUpdater from '~/state/beanstalk/sun/morning';
import MorningFieldUpdater from '~/state/beanstalk/field/morning';
import BeanstalkCaseUpdater from '~/state/beanstalk/case/updater';
import useChainState from '~/hooks/chain/useChainState';
import EthMainnet from '~/pages/mainnet';
// import Snowflakes from './theme/winter/Snowflakes';

BigNumber.set({ EXPONENTIAL_AT: [-12, 20] });

const CustomToaster: FC<{ navHeight: number }> = ({ navHeight }) => (
  <Toaster
    containerStyle={{
      top: navHeight + 10,
    }}
    toastOptions={{
      duration: 4000,
      position: 'top-right',
      style: {
        minWidth: 300,
        maxWidth: 400,
        paddingLeft: '16px',
      },
    }}
  >
    {(t) => (
      <ToastBar
        toast={t}
        style={{
          ...t.style,
          fontFamily: 'Futura PT',
          animation: 'none',
          marginRight: t.visible ? 0 : -500,
          transition: 'margin-right 0.4s ease-in-out',
          opacity: 1,
        }}
      />
    )}
  </Toaster>
);

function Mainnet() {
  const banner = useBanner();
  const navHeight = useNavHeight(!!banner);
  const { isArbitrum } = useChainState();
  return (
    <>
      <NavBar>{null}</NavBar>
      <Box
        sx={{
          bgcolor: 'background.default',
          backgroundImage: `url(${pageBackground})`,
          backgroundAttachment: 'fixed',
          backgroundPosition: 'bottom center',
          backgroundSize: '100%',
          backgroundRepeat: 'no-repeat',
          width: '100%',
          minHeight: `calc(100vh - ${navHeight}px)`,
        }}
      >
        <Stack
          sx={{
            width: '100vw',
            minHeight: `calc(100vh - ${navHeight}px)`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <EthMainnet message={isArbitrum ? 'Coming soon' : undefined} />
          {/* <Routes>
            <Route path="/*" element={<EthMainnet />} />
          </Routes> */}
        </Stack>
      </Box>
    </>
  );
}

function Arbitrum() {
  const banner = useBanner();
  const navHeight = useNavHeight(!!banner);
  const account = useAccount();

  return (
    <>
      {/* -----------------------
       * Appplication Setup
       * ----------------------- */}
      <AppUpdater />
      {/* -----------------------
       * Bean Updaters
       * ----------------------- */}
      {/* price contract not working */}
      <PoolsUpdater />
      <UnripeUpdater />

      {/* -----------------------
       * Beanstalk Updaters
       * ----------------------- */}
      <SiloUpdater />
      <FieldUpdater />
      <SunUpdater />
      <BarnUpdater />
      <MorningUpdater />
      <MorningFieldUpdater />
      <BeanstalkCaseUpdater />

      {false && (
        <>
          <GovernanceUpdater />
        </>
      )}

      {/* -----------------------
       * Farmer Updaters
       * ----------------------- */}
      <FarmerSiloUpdater />
      <FarmerFieldUpdater />
      <FarmerBarnUpdater />
      <FarmerBalancesUpdater />
      {false && (
        <>
          <FarmerMarketUpdater />
          <FarmerDelegationsUpdater />
        </>
      )}
      {/* -----------------------
       * Routes & Content
       * ----------------------- */}
      <NavBar>{banner}</NavBar>
      <EnforceNetwork />
      <CustomToaster navHeight={navHeight} />
      {account && <NewProposalsDialog />}
      {/* <Leaves /> */}
      {/* <Snowflakes /> */}
      <Box
        sx={{
          bgcolor: 'background.default',
          backgroundImage: `url(${pageBackground})`,
          backgroundAttachment: 'fixed',
          backgroundPosition: 'bottom center',
          backgroundSize: '100%',
          backgroundRepeat: 'no-repeat',
          width: '100%',
          minHeight: `calc(100vh - ${navHeight}px)`,
        }}
      >
        {/* use zIndex to move content over content */}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Routes>
            <Route index element={<ForecastPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/balances" element={<BalancesPage />} />
            <Route path="/barn" element={<Barn />} />
            <Route path="/chop" element={<ChopPage />} />
            <Route path="/field" element={<FieldPage />} />
            <Route path="/governance" element={<GovernancePage />} />
            <Route path="/history" element={<TransactionHistoryPage />} />
            <Route
              path="/market"
              index
              element={<Navigate to="/market/buy" />}
            />
            <Route path="/market" element={<PodMarketPage />}>
              {/* https://ui.dev/react-router-nested-routes */}
              <Route path="/market/buy" element={<PodMarketBuy />}>
                <Route index element={<PodMarketCreateOrder />} />
                <Route
                  path="/market/buy/:listingID"
                  element={<PodMarketFillListing />}
                />
              </Route>
              <Route path="/market/sell" element={<PodMarketSell />}>
                <Route index element={<PodMarketCreateListing />} />
                <Route
                  path="/market/sell/:orderID"
                  element={<PodMarketFillOrder />}
                />
              </Route>
              <Route
                path="listing/:listingID"
                element={<Navigate to="/market/buy/:listingID" />}
              />
              <Route
                path="order/:orderID"
                element={<Navigate to="/market/sell/:orderID" />}
              />
            </Route>
            <Route path="/nft" element={<NFTPage />} />
            <Route path="/governance/:id" element={<ProposalPage />} />
            <Route
              path="/governance/delegate/:type"
              element={<FarmerDelegatePage />}
            />
            <Route path="governance/vp/:id" element={<VotingPowerPage />} />
            <Route path="/silo" element={<SiloPage />} />
            <Route path="/silo/:address" element={<SiloTokenPage />} />
            <Route path="/swap" element={<SwapPage />} />
            <Route path="/404" element={<PageNotFound />} />
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Box>
      </Box>
    </>
  );
}

export default function App() {
  const { isArbitrum, isDev: isTestnet } = useChainState();

  console.log('isArbitrum: ', isArbitrum);
  console.log('isTestnet: ', isTestnet);

  if (!isArbitrum || (isArbitrum && !isTestnet)) {
    return <Mainnet />;
  }

  return <Arbitrum />;
}
