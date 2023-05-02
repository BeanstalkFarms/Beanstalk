import { Card, Stack, Typography } from '@mui/material';
import React from 'react';
import useFarmerDelegations from '~/hooks/farmer/useFarmerDelegations';
import { useFetchVotingPower } from '~/state/farmer/delegations/updater';
import { GOV_SLUGS_TAB_MAP } from './GovernanceSpaces';
import useAccount from '~/hooks/ledger/useAccount';
import { displayBN, trimAddress } from '~/util';
import { IconSize } from '../App/muiTheme';
import AddressIcon from '../Common/AddressIcon';
import Row from '../Common/Row';
import { STALK } from '~/constants/tokens';
import TokenIcon from '../Common/TokenIcon';
import { GovSpace } from '~/lib/Beanstalk/Governance';

const VotingPowerCard: React.FC<{ tab: number }> = ({ tab }) => {
  const delegations = useFarmerDelegations();
  useFetchVotingPower();
  const account = useAccount();

  const vps = delegations.delegatorVotingPower;
  const space = GOV_SLUGS_TAB_MAP[tab as keyof typeof GOV_SLUGS_TAB_MAP];
  const vp = vps[space];

  return (
    <Card sx={{ position: 'sticky', top: 120, p: 2 }}>
      <Stack gap={1}>
        <Typography variant="h4">Voting Power</Typography>
        {vp && account && (
          <Row gap={0.3}>
            <AddressIcon address={account} size={IconSize.xs} />
            <Typography variant="body1">{trimAddress(account)}</Typography>
          </Row>
        )}
        {space !== GovSpace.BeanNFT ? (
          <Row gap={0.5}>
            <TokenIcon token={STALK} css={{ height: IconSize.small }} />
            <Typography variant="bodyLarge">{displayBN(vp)} STALK</Typography>
          </Row>
        ) : (
          <Typography variant="bodyLarge">{displayBN(vp)} BeaNFTs</Typography>
        )}
      </Stack>
    </Card>
  );
};

export default VotingPowerCard;
