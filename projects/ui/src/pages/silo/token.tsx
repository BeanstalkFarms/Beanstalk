import React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Card, Container, Stack, Typography } from '@mui/material';
import SiloActions from '~/components/Silo/Actions';
import PageHeaderSecondary from '~/components/Common/PageHeaderSecondary';
import TokenIcon from '~/components/Common/TokenIcon';
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
import TokenDepositsOverview from '~/components/Silo/Token/TokenDepositsOverview';
import TokenDepositRewards from '~/components/Silo/Token/TokenDepositRewards';
import TokenAbout from '~/components/Silo/Token/TokenAbout';
import {
  SiloTokenSlug,
  TokenDepositsProvider,
  useTokenDepositsContext,
} from '~/components/Silo/Token/TokenDepositsContext';
import { ERC20Token } from '@beanstalk/sdk';
import TokenTransferDeposits from '~/components/Silo/Token/TokenTransferDeposits';
import Transfer from '~/components/Silo/Actions/Transfer';
import {
  Module,
  ModuleContent,
  ModuleHeader,
} from '~/components/Common/Module';
import TokenLambdaConvert from '~/components/Silo/Token/TokenLambdaConvert';
import ToggleTabGroup from '~/components/Common/ToggleTabGroup';

const guides = [
  HOW_TO_DEPOSIT_IN_THE_SILO,
  HOW_TO_CONVERT_DEPOSITS,
  HOW_TO_TRANSFER_DEPOSITS,
  HOW_TO_WITHDRAW_FROM_THE_SILO,
];

const SILO_ACTIONS_MAX_WIDTH = '480px';

type TokenPageBaseProps = {
  token: ERC20Token;
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

const TransferContent = ({ token }: Omit<TokenPageBaseProps, 'pool'>) => (
  <Stack gap={2} direction={{ xs: 'column', lg: 'row' }} width="100%">
    <Module sx={{ p: 2, width: '100%' }}>
      <TokenTransferDeposits token={token} />
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

const LambdaConvertContent = (props: Pick<TokenPageBaseProps, 'token'>) => (
  <Stack width="100%" alignItems="center">
    <Module sx={{ p: 2, width: '100%', maxWidth: '903px' }}>
      <TokenLambdaConvert {...props} />
    </Module>
  </Stack>
);

const SlugSwitchContent = ({ token }: TokenPageBaseProps) => {
  const { slug, setSlug } = useTokenDepositsContext();

  const isTokenView = slug === 'token' || !slug;
  const isTransferView = slug === 'transfer';
  const isLambdaView = slug === 'lambda';
  const isAntiLambdaView = slug === 'anti-lambda';

  return (
    <>
      <Container sx={{ maxWidth: `${XXLWidth}px !important`, width: '100%' }}>
        <Stack gap={2} width="100%">
          {(isTokenView || isTransferView) && (
            <>
              <PagePathContent
                token={token}
                title={isTransferView ? 'Transfer Deposits' : undefined}
              />
              {isTokenView && <DefaultContent token={token} />}
              {isTransferView && <TransferContent token={token} />}
            </>
          )}
          {(isAntiLambdaView || isLambdaView) && (
            <>
              <Box
                sx={{
                  alignSelf: 'center',
                  backgroundColor: 'white',
                  borderRadius: 1,
                  border: `1px solid`,
                  borderColor: 'divider',
                  background: 'background.main',
                }}
              >
                <ToggleTabGroup<SiloTokenSlug>
                  selected={slug}
                  setSelected={(v: SiloTokenSlug) => setSlug(v)}
                  options={[
                    { label: 'My Deposits', value: 'lambda' },
                    { label: "Other's Deposits", value: 'anti-lambda' },
                  ]}
                />
              </Box>
              {isLambdaView && <LambdaConvertContent token={token} />}
            </>
          )}
        </Stack>
      </Container>
    </>
  );
};

const TokenPage: FC<{}> = () => {
  let { address } = useParams<{ address: string }>();
  address = address?.toLowerCase();

  const whitelist = useSdkWhitelist();
  const whitelistedToken = whitelist?.[address || ''];

  if (!address || !whitelistedToken) {
    return <div>Not found</div>;
  }

  return (
    <TokenDepositsProvider token={whitelistedToken}>
      <SlugSwitchContent token={whitelistedToken} />
    </TokenDepositsProvider>
  );
};

export default TokenPage;
