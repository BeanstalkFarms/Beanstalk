import React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Card, Container, Stack, Typography, Button } from '@mui/material';
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
import Row from '~/components/Common/Row';
import CloseIcon from '@mui/icons-material/Close';
import LambdaConvert from '~/components/Silo/Actions/LambdaConvert';

const guides = [
  HOW_TO_DEPOSIT_IN_THE_SILO,
  HOW_TO_CONVERT_DEPOSITS,
  HOW_TO_TRANSFER_DEPOSITS,
  HOW_TO_WITHDRAW_FROM_THE_SILO,
];

const SILO_ACTIONS_MAX_WIDTH = '480px';

const UPDATE_DEPOSITS_MAX_WIDTH = '470px';

type Props = {
  token: ERC20Token;
};

const DefaultContent = (props: Props) => (
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
        <TokenDepositsOverview {...props} />
      </Card>
      <Card sx={{ p: 2 }}>
        <TokenDepositRewards {...props} />
      </Card>
      <Card sx={{ p: 2 }}>
        <TokenAbout {...props} />
      </Card>
    </Stack>
    <Stack
      gap={2}
      width="100%"
      sx={{ maxWidth: { lg: SILO_ACTIONS_MAX_WIDTH } }}
    >
      <SiloActions {...props} />
    </Stack>
  </Stack>
);

const TransferContent = ({
  token,
  handleClose,
}: Props & {
  handleClose: () => void;
}) => (
  <Stack gap={2} direction={{ xs: 'column', lg: 'row' }} width="100%">
    <Module sx={{ width: '100%', height: '100%' }}>
      <ModuleHeader pb={1}>
        <Row justifyContent="space-between">
          <Typography variant="h4">Select Deposits to Transfer</Typography>
          <Button
            variant="outlined-secondary"
            color="secondary"
            size="small"
            endIcon={<CloseIcon fontSize="inherit" />}
            onClick={handleClose}
          >
            Close
          </Button>
        </Row>
      </ModuleHeader>
      <ModuleContent px={2}>
        <TokenTransferDeposits token={token} />
      </ModuleContent>
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
      <ModuleHeader pb={1}>
        <Typography fontWeight={FontWeight.bold}>Transfer Deposits</Typography>
      </ModuleHeader>
      <ModuleContent>
        <Transfer token={token} />
      </ModuleContent>
    </Module>
  </Stack>
);

const LambdaConvertContent = ({
  token,
  handleClose,
}: Props & {
  handleClose: () => void;
}) => {
  const { selected } = useTokenDepositsContext();
  const hasSelected = Boolean(selected.size);

  return (
    <Stack gap={2} direction={{ xs: 'column', lg: 'row' }} width="100%">
      <Stack width="100%" alignItems="center">
        <Module sx={{ width: '100%' }}>
          <ModuleHeader pb={1}>
            <Row justifyContent="space-between">
              <Typography variant="h4" fontWeight={FontWeight.bold}>
                Update Deposits
              </Typography>
              <Button
                variant="outlined-secondary"
                color="secondary"
                size="small"
                endIcon={<CloseIcon fontSize="inherit" />}
                onClick={handleClose}
              >
                Close
              </Button>
            </Row>
          </ModuleHeader>
          <ModuleContent px={2}>
            <TokenLambdaConvert token={token} />
          </ModuleContent>
        </Module>
      </Stack>
      {hasSelected && (
        <Module
          sx={{
            maxWidth: {
              lg: UPDATE_DEPOSITS_MAX_WIDTH,
              width: '100%',
              height: '100%',
            },
          }}
        >
          <ModuleHeader>
            <Typography variant="h4" fontWeight={FontWeight.bold}>
              Update Deposits
            </Typography>
          </ModuleHeader>
          <ModuleContent px={1}>
            <LambdaConvert />
          </ModuleContent>
        </Module>
      )}
    </Stack>
  );
};
const TokenLambdasView = () => {
  const { token, slug, setSlug, clear } = useTokenDepositsContext();

  return (
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
          setSelected={(v) => setSlug(v, clear)}
          options={[
            { label: 'My Deposits', value: 'lambda' },
            { label: "Other's Deposits", value: 'anti-lambda' },
          ]}
        />
      </Box>
      {slug === 'lambda' && (
        <LambdaConvertContent
          token={token}
          handleClose={() => setSlug('token', clear)}
        />
      )}
    </>
  );
};

const TokenOrTransferView = () => {
  const { token, slug, setSlug, clear } = useTokenDepositsContext();

  return (
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
        title={slug === 'transfer' ? 'Transfer Deposits' : token.name}
        titleAlign="left"
        icon={<TokenIcon css={{ marginBottom: '-3px' }} token={token} />}
        returnPath="/silo"
        hideBackButton
        control={
          <GuideButton
            title="The Farmers' Almanac: Silo Guides"
            guides={guides}
          />
        }
      />
      {slug === 'token' && <DefaultContent token={token} />}
      {slug === 'transfer' && (
        <TransferContent
          token={token}
          handleClose={() => setSlug('token', clear)}
        />
      )}
    </>
  );
};

const SlugSwitchContent = () => {
  const { slug } = useTokenDepositsContext();

  return (
    <Container sx={{ maxWidth: `${XXLWidth}px !important`, width: '100%' }}>
      <Stack gap={2} width="100%">
        {(slug === 'token' || slug === 'transfer') && <TokenOrTransferView />}
        {(slug === 'lambda' || slug === 'anti-lambda') && <TokenLambdasView />}
      </Stack>
    </Container>
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
      <SlugSwitchContent />
    </TokenDepositsProvider>
  );
};

export default TokenPage;
