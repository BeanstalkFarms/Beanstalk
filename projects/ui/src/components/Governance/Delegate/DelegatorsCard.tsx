import React from 'react';
import { Card, Stack, Tooltip, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { FontSize, IconSize } from '~/components/App/muiTheme';
import AddressIcon from '~/components/Common/AddressIcon';
import Row from '~/components/Common/Row';
import { trimAddress } from '~/util';
import useFarmerDelegations from '~/hooks/farmer/useFarmerDelegations';
import { GOV_SLUGS_TAB_MAP, GOV_SLUGS } from '../GovernanceSpaces';

const DelegatorsCard: React.FC<{ tab: number }> = ({ tab }) => {
  const farmerDelegations = useFarmerDelegations();

  const delegators = farmerDelegations.delegators;

  const space = GOV_SLUGS_TAB_MAP[tab as keyof typeof GOV_SLUGS_TAB_MAP];
  const _delegatorsBySpace = Object.values(delegators[space] || {});
  const slug = GOV_SLUGS[tab];

  if (!_delegatorsBySpace.length) {
    return null;
  }

  return (
    <Card>
      <Stack
        p={2}
        gap={1}
        alignItems="flex-start"
        justifyContent="space-between"
      >
        <Typography variant="h4">
          Delegators
          <Tooltip title="Wallet addresses that have delegated their votes to you">
            <HelpOutlineIcon
              sx={{
                color: 'text.secondary',
                fontSize: FontSize.xs,
                mb: 0.2,
                ml: 0.1,
              }}
            />
          </Tooltip>
        </Typography>
        <Stack
          gap={0.5}
          width="100%"
          alignItems="flex-start"
          justifyContent="space-between"
        >
          <Typography color="text.secondary">{slug}</Typography>
          <Stack>
            {_delegatorsBySpace.map((delegator, i) => (
              <Row gap={0.3} key={delegator.address + i.toString()}>
                <AddressIcon address={delegator.address} size={IconSize.xs} />
                <Typography>{trimAddress(delegator.address)}</Typography>
              </Row>
            ))}
          </Stack>
        </Stack>
      </Stack>
    </Card>
  );
};
export default DelegatorsCard;
