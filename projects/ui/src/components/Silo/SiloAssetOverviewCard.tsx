import React from 'react';

import CallMadeIcon from '@mui/icons-material/CallMade';
import { Link, Stack, Typography } from '@mui/material';

import {
  SEEDS,
  STALK,
} from '~/constants/tokens';
import { FontSize } from '../App/muiTheme';
import Stat from '../Common/Stat';
import TokenIcon from '../Common/TokenIcon';
import { BEANSTALK_ADDRESSES, CURVE_LINK } from '~/constants';
import DepositedAsset from '../Analytics/Silo/DepositedAsset';

import SiloCarousel from './SiloCarousel';
import Token, { ERC20Token } from '~/classes/Token';
import Row from '~/components/Common/Row';
import {
  Module,
  ModuleContent,
  ModuleHeader,
} from '~/components/Common/Module';
import useTVD from '~/hooks/beanstalk/useTVD';
import { displayFullBN } from '~/util';
import EmbeddedCard from '../Common/EmbeddedCard';
import SiloAssetApyChip from './SiloAssetApyChip';
import useWhitelist from '~/hooks/beanstalk/useWhitelist';

import { FC } from '~/types';

const DepositRewards : FC<{ token: ERC20Token }> = ({ token }) => (
  <Row gap={1} justifyContent="center">
    <Row gap={0.5} justifyContent="center">
      <Typography variant="bodyLarge">
        <TokenIcon
          token={STALK}
          css={{ marginTop: '7px', height: '0.7em' }}
        />
        {token.rewards?.stalk}
      </Typography>
      <Row>
        <TokenIcon
          token={SEEDS}
          css={{ fontSize: 'inherit' }}
        />
        <Typography variant="bodyLarge">
          {token.rewards?.seeds}
        </Typography>
      </Row>
    </Row>
    <SiloAssetApyChip 
      token={token as Token}
      metric="bean"
      variant="labeled"
    />
  </Row>
);

const SiloAssetOverviewCard: FC<{ token: ERC20Token }> = ({ token }) => {
  const { total, tvdByToken } = useTVD();
  const whitelist = useWhitelist();

  const isRipeAndIsLP = token.isLP && !token.isUnripe;
  const tokenTVD = tvdByToken[token.address];
  const tokenPctTVD = tokenTVD.div(total).times(100);

  return (
    <Module>
      <ModuleHeader>
        <Row gap={2} justifyContent="space-between">
          <Typography variant="h4">{token.name} Overview</Typography>
          {isRipeAndIsLP ? (
            <Link
              href={CURVE_LINK}
              target="_blank"
              rel="noreferrer"
              underline="none"
              color="text.primary"
              sx={{ 
                flexWrap: 'nowrap', 
                ':hover': { color: 'primary.main' }, 
              }}
            >
              View Liquidity
              <CallMadeIcon sx={{ fontSize: FontSize.xs, ml: 0.5 }} />
            </Link>
          ) : null}
        </Row>
      </ModuleHeader>
      <ModuleContent px={2} pb={2}>
        <Stack gap={2}>
          {/* Token Graph */}
          <EmbeddedCard sx={{ pt: 2 }}>
            <DepositedAsset
              asset={whitelist[token.address]}
              account={BEANSTALK_ADDRESSES[1]}
              height={230}
            />
          </EmbeddedCard>

          {/* Stats */}
          <Row gap={2} justifyContent="space-between" flexWrap="wrap" py={1}>
            <Stat
              gap={0}
              title="TVD"
              variant="bodyLarge"
              amount={`$${displayFullBN(tokenTVD, token.displayDecimals)}`}
            />
            <Stat
              gap={0}
              title="% of TVD in Silo"
              amount={`${displayFullBN(tokenPctTVD, 2, 2)}%`}
              variant="bodyLarge"
            />
            <Stat gap={0} title="Deposit Rewards" amount={<DepositRewards token={token} />} />
          </Row>

          {/* Card Carousel */}
          <SiloCarousel token={token} />
        </Stack>
      </ModuleContent>
    </Module>
  );
};

export default SiloAssetOverviewCard;
