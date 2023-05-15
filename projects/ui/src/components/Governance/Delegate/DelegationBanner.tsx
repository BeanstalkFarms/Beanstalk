import { Link, Button, Typography } from '@mui/material';
import React from 'react';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DatasetLinkedOutlinedIcon from '@mui/icons-material/DatasetLinkedOutlined';
import { Link as RouterLink } from 'react-router-dom';

import { BeanstalkPalette } from '~/components/App/muiTheme';
import Row from '~/components/Common/Row';
import { GovSpace } from '~/lib/Beanstalk/Governance';
import {
  GOV_SLUGS,
  displayFullBN,
  getGovSpaceLabel,
  getGovSpaceWithTab,
  trimAddress,
} from '~/util';
import { FarmerDelegation } from '~/state/farmer/delegations';
import useAccount from '~/hooks/ledger/useAccount';
import useFarmerVotingPower from '~/hooks/farmer/useFarmerVotingPower';
import useSdk from '~/hooks/sdk';

export type DelegationBannerProps = {
  tab: number;
  farmerDelegations: FarmerDelegation;
  votingPower: ReturnType<typeof useFarmerVotingPower>['votingPower'];
};

const DelegationBanner: React.FC<DelegationBannerProps> = ({
  tab,
  farmerDelegations,
  votingPower,
}) => {
  const sdk = useSdk();
  const space = getGovSpaceWithTab(tab);
  const account = useAccount();

  const stalk = sdk.tokens.STALK;

  const delegate = farmerDelegations.delegates[space];

  const isNFT = space === GovSpace.BeanNFT;

  if (!account) return null;

  return (
    <Button
      variant="outlined"
      component={RouterLink}
      to={`/governance/delegate/${GOV_SLUGS[tab]}`}
      sx={{
        p: 0,
        height: '100%',
        borderColor: BeanstalkPalette.blue,
        color: 'text.primary',
        background: BeanstalkPalette.lightestBlue,
        ':hover': {
          background: BeanstalkPalette.lightestGreen,
          borderColor: 'primary.main',
        },
      }}
    >
      <Row justifyContent="space-between" width="100%" p={2}>
        <Row gap={1}>
          <DatasetLinkedOutlinedIcon
            sx={{ color: 'inherit', fontSize: 'inherit' }}
          />
          {delegate ? (
            <Typography>
              Your {displayFullBN(votingPower.farmer, 0)}&nbsp;
              {isNFT ? 'BEANFT' : stalk.name} is delegated to&nbsp;
              <Link
                component="a"
                href={`https://snapshot.org/#/profile/${delegate.address}`}
                target="_blank"
                rel="noreferrer"
                color="inherit"
                variant="h4"
              >
                {trimAddress(delegate.address)}
              </Link>
              &nbsp;for {getGovSpaceLabel(space)} proposals
            </Typography>
          ) : (
            <Typography>
              Delegate your {isNFT ? 'BeaNFT' : 'Stalk'} votes to another Farmer
              on&nbsp;
              <Typography component="span" variant="h4">
                {space.toString()}
              </Typography>
            </Typography>
          )}
        </Row>
        <ChevronRightIcon
          sx={{ color: 'inherit', height: '24px', width: '24px' }}
        />
      </Row>
    </Button>
  );
};
export default DelegationBanner;
