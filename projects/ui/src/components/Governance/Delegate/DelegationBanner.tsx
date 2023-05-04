import { Link, Button, Typography } from '@mui/material';
import React from 'react';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DatasetLinkedOutlinedIcon from '@mui/icons-material/DatasetLinkedOutlined';
import { Link as RouterLink } from 'react-router-dom';

import { BeanstalkPalette } from '~/components/App/muiTheme';
import Row from '~/components/Common/Row';
import { GovSpace } from '~/lib/Beanstalk/Governance';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import { displayFullBN, getGovSpaceLabel, trimAddress } from '~/util';
import { STALK } from '~/constants/tokens';
import { FarmerDelegation } from '~/state/farmer/delegations';
import useAccount from '~/hooks/ledger/useAccount';

export type DelegationBannerProps = {
  tab: number;
  space: GovSpace;
  getSlug: (_tab: number) => string;
  farmerDelegations: FarmerDelegation;
};

const DelegationBanner: React.FC<DelegationBannerProps> = ({
  tab,
  space,
  getSlug,
  farmerDelegations,
}) => {
  const farmerSilo = useFarmerSilo();
  const account = useAccount();

  const stalkAmount = farmerSilo.stalk.active;

  const delegate = farmerDelegations.delegates[space];

  const getLabel = (prependThe: boolean = false) => {
    const _label = getGovSpaceLabel(space);
    if (!prependThe) {
      return _label;
    }
    return _label.toLowerCase().includes('dao') ? _label : `the ${_label}`;
  };

  const isNFT = space === GovSpace.BeanNFT;

  if (!account) return null;

  return (
    <Button
      variant="outlined"
      component={RouterLink}
      to={`/governance/delegate/${getSlug(tab)}`}
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
              Your {displayFullBN(stalkAmount, 0)} {STALK.name} is delegated
              to&nbsp;
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
              &nbsp;for {getLabel()} proposals
            </Typography>
          ) : (
            <Typography variant="subtitle1">
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
