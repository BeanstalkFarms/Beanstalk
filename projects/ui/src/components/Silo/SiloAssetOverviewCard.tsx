import React from 'react';
import CallMadeIcon from '@mui/icons-material/CallMade';
import { Box, Link, Stack, Typography } from '@mui/material';
import { FC } from '~/types';
import { SEEDS, STALK, BEAN_ETH_WELL_LP } from '~/constants/tokens';
import Token, { ERC20Token } from '~/classes/Token';
import Row from '~/components/Common/Row';
import {
  Module,
  ModuleContent,
  ModuleHeader,
} from '~/components/Common/Module';
import useTVD from '~/hooks/beanstalk/useTVD';
import { displayFullBN } from '~/util';
import { BASIN_WELL_LINK, BEANSTALK_ADDRESSES, CURVE_LINK } from '~/constants';
import useWhitelist from '~/hooks/beanstalk/useWhitelist';
import { FontSize } from '../App/muiTheme';
import Stat from '../Common/Stat';
import TokenIcon from '../Common/TokenIcon';
import DepositedAsset from '../Analytics/Silo/DepositedAsset';
import SiloCarousel from './SiloCarousel';
import EmbeddedCard from '../Common/EmbeddedCard';
import SiloAssetApyChip from './SiloAssetApyChip';

const DepositRewards: FC<{ token: ERC20Token }> = ({ token }) => (
  <Box>
    <Row gap={1} justifyContent="start">
      <Row gap={0.5} justifyContent="center">
        <Typography variant="bodyLarge">
          <TokenIcon
            token={STALK}
            css={{ marginTop: '7px', height: '0.7em' }}
          />
          {token.rewards?.stalk}
        </Typography>
        <Row>
          <TokenIcon token={SEEDS} css={{ fontSize: 'inherit' }} />
          <Typography variant="bodyLarge">{token.rewards?.seeds}</Typography>
        </Row>
      </Row>
      {/* This vAPY chip is only shown on larger screens */}
      <Row sx={{ display: { xs: 'none', sm: 'block' } }}>
        <SiloAssetApyChip
          token={token as Token}
          metric="bean"
          variant="labeled"
        />
      </Row>
    </Row>
  </Box>
);

const SiloAssetOverviewCard: FC<{ token: ERC20Token }> = ({ token }) => {
  const { total, tvdByToken } = useTVD();
  const whitelist = useWhitelist();

  const isRipeAndIsLP = token.isLP && !token.isUnripe;
  const isWell = token.equals(BEAN_ETH_WELL_LP[1]);
  const tokenTVD = tvdByToken[token.address];
  const tokenPctTVD = tokenTVD.div(total).times(100);

  return (
    <Module>
      <ModuleHeader>
        <Row gap={2} justifyContent="space-between">
          <Typography variant="h4">{token.name} Overview</Typography>
          {isRipeAndIsLP ? (
            <Link
              href={isWell ? `${BASIN_WELL_LINK}${token.address}` : CURVE_LINK}
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
            <Stat
              gap={0}
              title="Deposit Rewards"
              amount={<DepositRewards token={token} />}
            />
          </Row>
          {/* This vAPY chip is only shown on mobile screens */}
          <Row
            justifyContent="center"
            sx={{ display: { xs: 'flex', sm: 'none' } }}
          >
            <SiloAssetApyChip
              token={token as Token}
              metric="bean"
              variant="labeled"
            />
          </Row>
          {/* Card Carousel */}
          <SiloCarousel token={token} />
        </Stack>
      </ModuleContent>
    </Module>
  );
};

export default SiloAssetOverviewCard;
