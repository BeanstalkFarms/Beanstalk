import { Alert, Box, Card, Link, Tab, Tabs, Typography } from '@mui/material';
import React from 'react';
import { BEAN, BEAN_CRV3_LP, UNRIPE_BEAN, UNRIPE_BEAN_CRV3 } from '~/constants/tokens';
import { BEANSTALK_ADDRESSES } from '~/constants';
import { clearApolloCache } from '~/util';
import useTabs from '~/hooks/display/useTabs';
import Stalk from '~/components/Analytics/Silo/Stalk';
import Seeds from '~/components/Analytics/Silo/Seeds';
import DepositedAsset from '~/components/Analytics/Silo/DepositedAsset';
import WarningIcon from '~/components/Common/Alert/WarningIcon';
import APY from '~/components/Analytics/Silo/APY';

// const SLUGS = ['deposited_bean','deposited_lp','deposited_urbean','deposited_urlp','stalk','seeds',];
import { FC } from '~/types';

const SiloAnalytics: FC<{}> = () => {
  const [tab, handleChangeTab] = useTabs();
  return (
    <Card>
      <Tabs value={tab} onChange={handleChangeTab} sx={{ px: 2, pt: 2, pb: 1.5 }}>
        <Tab label="Deposited BEAN" />
        <Tab label="Deposited BEAN3CRV" />
        <Tab label="Deposited urBEAN" />
        <Tab label="Deposited urBEAN3CRV" />
        <Tab label="Stalk" />
        <Tab label="Seeds" />
        <Tab label="Bean vAPY" />
        <Tab label="LP vAPY" />
      </Tabs>
      <Box px={1} mb={1.5}>
        <Alert variant="standard" color="warning" icon={<WarningIcon />}>
          Silo analytics are under active development. Data shown may be incorrect.<br />
          <Typography fontSize="small">Graphs not working? <Link href="#/analytics" underline="hover" onClick={() => clearApolloCache()}>Clear cache</Link></Typography>
        </Alert>
      </Box>
      {tab === 0 && <DepositedAsset asset={BEAN[1]} account={BEANSTALK_ADDRESSES[1]} height={300} />}
      {tab === 1 && <DepositedAsset asset={BEAN_CRV3_LP[1]} account={BEANSTALK_ADDRESSES[1]} height={300} />}
      {tab === 2 && <DepositedAsset asset={UNRIPE_BEAN[1]} account={BEANSTALK_ADDRESSES[1]} height={300} />}
      {tab === 3 && <DepositedAsset asset={UNRIPE_BEAN_CRV3[1]} account={BEANSTALK_ADDRESSES[1]} height={300} />}
      {tab === 4 && <Stalk height={300} />}
      {tab === 5 && <Seeds height={300} />}
      {tab === 6 && <APY height={300} metric="Bean" />}
      {tab === 7 && <APY height={300} metric="LP" />}
    </Card>
  );
};
export default SiloAnalytics;
