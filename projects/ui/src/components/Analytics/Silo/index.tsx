import { Card, Tab, Tabs } from '@mui/material';
import React from 'react';
import {
  BEAN,
  BEAN_CRV3_LP,
  BEAN_ETH_WELL_LP,
  UNRIPE_BEAN,
  UNRIPE_BEAN_WETH,
} from '~/constants/tokens';
import { BEANSTALK_ADDRESSES } from '~/constants';
import useTabs from '~/hooks/display/useTabs';
import Stalk from '~/components/Analytics/Silo/Stalk';
import DepositedAsset from '~/components/Analytics/Silo/DepositedAsset';
import APY from '~/components/Analytics/Silo/APY';
import { FC } from '~/types';

const SLUGS = [
  'deposited_bean',
  'deposited_lp',
  'deposited_beaneth',
  'deposited_urbean',
  'deposited_urlp',
  'stalk',
  // 'seeds',
  'bean_vAPY',
  'bean_3crv_vAPY',
  'bean_eth_well_vAPY',
  'ur_bean_vAPY',
  'ur_bean_eth_vAPY',
];

const SiloAnalytics: FC<{}> = () => {
  const [tab, handleChangeTab] = useTabs(SLUGS, 'silo');
  return (
    <Card>
      <Tabs
        value={tab}
        onChange={handleChangeTab}
        sx={{ px: 2, pt: 2, pb: 1.5 }}
      >
        <Tab label="Deposited BEAN" />
        <Tab label="Deposited BEAN3CRV" />
        <Tab label="Deposited BEANETH" />
        <Tab label="Deposited urBEAN" />
        <Tab label="Deposited urBEANETH" />
        <Tab label="Stalk" />
        {/* <Tab label="Seeds" /> */}
        <Tab label="BEAN vAPY" />
        <Tab label="BEAN3CRV vAPY" />
        <Tab label="BEANETH vAPY" />
        <Tab label="urBEAN vAPY" />
        <Tab label="urBEANETH vAPY" />
      </Tabs>
      {tab === 0 && (
        <DepositedAsset
          asset={BEAN[1]}
          account={BEANSTALK_ADDRESSES[1]}
          height={300}
        />
      )}
      {tab === 1 && (
        <DepositedAsset
          asset={BEAN_CRV3_LP[1]}
          account={BEANSTALK_ADDRESSES[1]}
          height={300}
        />
      )}
      {tab === 2 && (
        <DepositedAsset
          asset={BEAN_ETH_WELL_LP[1]}
          account={BEANSTALK_ADDRESSES[1]}
          height={300}
        />
      )}
      {tab === 3 && (
        <DepositedAsset
          asset={UNRIPE_BEAN[1]}
          account={BEANSTALK_ADDRESSES[1]}
          height={300}
        />
      )}
      {tab === 4 && (
        <DepositedAsset
          asset={UNRIPE_BEAN_WETH[1]}
          account={BEANSTALK_ADDRESSES[1]}
          height={300}
        />
      )}
      {tab === 5 && <Stalk height={300} />}
      {/* {tab === 5 && <Seeds height={300} />} */}
      {tab === 6 && <APY height={300} metric="Bean" />}
      {tab === 7 && <APY height={300} metric="Bean3Curve" />}
      {tab === 8 && <APY height={300} metric="BeanETHWell" />}
      {tab === 9 && <APY height={300} metric="UnripeBean" />}
      {tab === 10 && <APY height={300} metric="UnripeBeanETH" />}
    </Card>
  );
};
export default SiloAnalytics;
