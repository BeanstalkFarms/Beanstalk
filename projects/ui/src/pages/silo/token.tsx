import React from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Container, Stack } from '@mui/material';
import SiloActions from '~/components/Silo/Actions';
import PageHeaderSecondary from '~/components/Common/PageHeaderSecondary';
import TokenIcon from '~/components/Common/TokenIcon';
import { ERC20Token } from '~/classes/Token';
import usePools from '~/hooks/beanstalk/usePools';
import useWhitelist from '~/hooks/beanstalk/useWhitelist';
import { AppState } from '~/state';
import GuideButton from '~/components/Common/Guide/GuideButton';
import {
  HOW_TO_CLAIM_WITHDRAWALS,
  HOW_TO_CONVERT_DEPOSITS,
  HOW_TO_DEPOSIT_IN_THE_SILO,
  HOW_TO_TRANSFER_DEPOSITS,
  HOW_TO_WITHDRAW_FROM_THE_SILO,
} from '~/util/Guides';
import SiloAssetOverviewCard from '~/components/Silo/SiloAssetOverviewCard';
import PagePath from '~/components/Common/PagePath';
import { XXLWidth } from '~/components/App/muiTheme';

import { FC } from '~/types';

const guides = [
  HOW_TO_DEPOSIT_IN_THE_SILO,
  HOW_TO_CONVERT_DEPOSITS,
  HOW_TO_TRANSFER_DEPOSITS,
  HOW_TO_WITHDRAW_FROM_THE_SILO,
  HOW_TO_CLAIM_WITHDRAWALS,
];

const TokenPage: FC<{}> = () => {
  // Constants
  const whitelist = useWhitelist();
  const pools = usePools();

  // Routing
  let { address } = useParams<{ address: string }>();
  address = address?.toLowerCase();

  // State
  const farmerSilo = useSelector<AppState, AppState['_farmer']['silo']>(
    (state) => state._farmer.silo
  );

  // Ensure this address is a whitelisted token
  if (!address || !whitelist?.[address]) {
    return <div>Not found</div>;
  }

  // Load this Token from the whitelist
  const whitelistedToken = whitelist[address];
  const siloBalance = farmerSilo.balances[whitelistedToken.address];

  // Most Silo Tokens will have a corresponding Pool.
  // If one is available, show a PoolCard with state info.
  const pool = pools[address];

  // If no data loaded...
  if (!whitelistedToken) return null;

  return (
    <Container
      sx={{ maxWidth: `${XXLWidth}px !important`, width: '100%' }}
    >
      <Stack gap={2} width="100%">
        <PagePath
          items={[
            { path: '/silo', title: 'Silo' },
            {
              path: `/silo/${whitelistedToken.address}`,
              title: whitelistedToken.name,
            },
          ]}
        />
        <PageHeaderSecondary
          title={whitelistedToken.name}
          titleAlign="left"
          icon={<TokenIcon css={{ marginBottom: -3 }} token={whitelistedToken} />}
          returnPath="/silo"
          hideBackButton
          control={
            <GuideButton
              title="The Farmers' Almanac: Silo Guides"
              guides={guides}
            />
          }
        />
        <Stack gap={2} direction={{ xs: 'column', lg: 'row' }} width="100%">
          <Stack
            width="100%"
            height="100%"
            sx={({ breakpoints }) => ({
              width: '100%',
              minWidth: 0,
              [breakpoints.up('lg')]: { maxWidth: '850px' },
            })}
          >
            <SiloAssetOverviewCard token={whitelistedToken} />
          </Stack>
          <Stack gap={2} width="100%" sx={{ flexShrink: 2 }}>
            <SiloActions
              pool={pool}
              token={whitelistedToken as ERC20Token}
              siloBalance={siloBalance}
            />
          </Stack>
        </Stack>
      </Stack>
    </Container>
  );
};

export default TokenPage;
