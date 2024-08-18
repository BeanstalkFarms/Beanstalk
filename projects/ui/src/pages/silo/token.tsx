import React from 'react';
import { useParams } from 'react-router-dom';
import { Card, Container, Stack, Typography } from '@mui/material';
import SiloActions from '~/components/Silo/Actions';
import PageHeaderSecondary from '~/components/Common/PageHeaderSecondary';
import TokenIcon from '~/components/Common/TokenIcon';
import usePools from '~/hooks/beanstalk/usePools';
import { useSdkWhitelist } from '~/hooks/beanstalk/useWhitelist';
import GuideButton from '~/components/Common/Guide/GuideButton';
import {
  HOW_TO_CONVERT_DEPOSITS,
  HOW_TO_DEPOSIT_IN_THE_SILO,
  HOW_TO_TRANSFER_DEPOSITS,
  HOW_TO_WITHDRAW_FROM_THE_SILO,
} from '~/util/Guides';
import PagePath from '~/components/Common/PagePath';
import { FontWeight, XXLWidth } from '~/components/App/muiTheme';

import { FC } from '~/types';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import TokenDepositsOverview from '~/components/Silo/Token/TokenDepositsOverview';
import TokenDepositRewards from '~/components/Silo/Token/TokenDepositRewards';
import TokenAbout from '~/components/Silo/Token/TokenAbout';
import {
  TokenDepositsProvider,
  useTokenDepositsContext,
} from '~/components/Silo/Token/TokenDepositsContext';
import { ERC20Token } from '@beanstalk/sdk';
import Pool from '~/classes/Pool';
import { FarmerSiloTokenBalance } from '~/state/farmer/silo';
import TokenTransferDeposits from '~/components/Silo/Token/TokenTransferDeposits';
import Transfer from '~/components/Silo/Actions/Transfer';
import {
  Module,
  ModuleContent,
  ModuleHeader,
} from '~/components/Common/Module';

const guides = [
  HOW_TO_DEPOSIT_IN_THE_SILO,
  HOW_TO_CONVERT_DEPOSITS,
  HOW_TO_TRANSFER_DEPOSITS,
  HOW_TO_WITHDRAW_FROM_THE_SILO,
];

const SILO_ACTIONS_MAX_WIDTH = '480px';

type TokenPageBaseProps = {
  token: ERC20Token;
  pool: Pool;
  siloBalance: FarmerSiloTokenBalance;
};

const PagePathContent = ({
  token,
  title,
}: {
  token: ERC20Token;
  title?: string;
}) => (
  <>
    <PagePath
      items={[
        { path: '/silo', title: 'Silo' },
        {
          path: `/silo/${token.address}`,
          title: token.name,
        },
      ]}
    />
    <PageHeaderSecondary
      title={title || token.name}
      titleAlign="left"
      icon={<TokenIcon css={{ marginBottom: -3 }} token={token} />}
      returnPath="/silo"
      hideBackButton
      control={
        <GuideButton
          title="The Farmers' Almanac: Silo Guides"
          guides={guides}
        />
      }
    />
  </>
);

const DefaultContent = ({ token }: Pick<TokenPageBaseProps, 'token'>) => (
  <Stack gap={2} direction={{ xs: 'column', lg: 'row' }} width="100%">
    <Stack
      width="100%"
      height="100%"
      gap={2}
      sx={({ breakpoints }) => ({
        width: '100%',
        minWidth: 0,
        [breakpoints.up('lg')]: { maxWidth: '850px' },
      })}
    >
      <Card sx={{ p: 1 }}>
        <TokenDepositsOverview token={token} />
      </Card>
      <Card sx={{ p: 2 }}>
        <TokenDepositRewards token={token} />
      </Card>
      <Card sx={{ p: 2 }}>
        <TokenAbout token={token} />
      </Card>
    </Stack>
    <Stack
      gap={2}
      width="100%"
      sx={{ maxWidth: { lg: SILO_ACTIONS_MAX_WIDTH } }}
    >
      <SiloActions token={token} />
    </Stack>
  </Stack>
);

const TransferContent = ({
  token,
  siloBalance,
}: Omit<TokenPageBaseProps, 'pool'>) => (
  <Stack gap={2} direction={{ xs: 'column', lg: 'row' }} width="100%">
    <Module sx={{ p: 2, width: '100%' }}>
      <TokenTransferDeposits token={token} siloBalance={siloBalance} />
    </Module>
    <Module
      sx={{
        maxWidth: {
          lg: SILO_ACTIONS_MAX_WIDTH,
          width: '100%',
          height: '100%',
        },
      }}
    >
      <ModuleHeader>
        <Typography fontWeight={FontWeight.bold}>Transfer Deposits</Typography>
      </ModuleHeader>
      <ModuleContent>
        <Transfer token={token} />
      </ModuleContent>
    </Module>
  </Stack>
);

const SlugSwitchContent = (props: TokenPageBaseProps) => {
  const { slug } = useTokenDepositsContext();

  const isTokenView = slug === 'token' || !slug;
  const isTransferView = slug === 'transfer';

  return (
    <>
      <Container sx={{ maxWidth: `${XXLWidth}px !important`, width: '100%' }}>
        <Stack gap={2} width="100%">
          {(isTokenView || isTransferView) && (
            <PagePathContent
              token={props.token}
              title={isTransferView ? 'Transfer Deposits' : undefined}
            />
          )}
          {isTokenView && <DefaultContent token={props.token} />}
          {isTransferView && <TransferContent {...props} />}
        </Stack>
      </Container>
    </>
  );
};

const TokenPage: FC<{}> = () => {
  let { address } = useParams<{ address: string }>();
  address = address?.toLowerCase();

  const whitelist = useSdkWhitelist();
  const farmerSilo = useFarmerSilo();
  const pools = usePools();

  const whitelistedToken = whitelist?.[address || ''];

  if (!address || !whitelistedToken) {
    return <div>Not found</div>;
  }

  const siloBalance = farmerSilo.balances[whitelistedToken.address];

  const pool = pools[address];

  return (
    <TokenDepositsProvider>
      <SlugSwitchContent
        token={whitelistedToken}
        pool={pool}
        siloBalance={siloBalance}
      />
    </TokenDepositsProvider>
  );
};

export default TokenPage;
