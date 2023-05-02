import React from 'react';
import { Button, Card, Stack, Tooltip, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { GOV_SLUGS, GOV_SLUGS_TAB_MAP } from '../GovernanceSpaces';
import { FontSize, IconSize } from '~/components/App/muiTheme';
import AddressIcon from '~/components/Common/AddressIcon';
import Row from '~/components/Common/Row';
import { trimAddress } from '~/util';
import useToggle from '~/hooks/display/useToggle';
import DelegateDialog from './DelegateDialog';
import useFarmerDelegations from '~/hooks/farmer/useFarmerDelegations';

const DelegatesCard: React.FC<{ tab: number }> = ({ tab }) => {
  const [open, show, hide] = useToggle();
  const { delegates } = useFarmerDelegations();

  const space = GOV_SLUGS_TAB_MAP[tab as keyof typeof GOV_SLUGS_TAB_MAP];
  const delegate = delegates[space];
  const slug = GOV_SLUGS[tab];

  return (
    <>
      <Card>
        <Stack gap={2} p={2} width="100%">
          <Stack gap={1}>
            <Row justifyContent="space-between">
              <Typography variant="h4">
                Delegates
                <Tooltip title="Wallet addresses you've delegated your voting power to">
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
            </Row>
            <Stack gap={0.5}>
              <Row justifyContent="space-between">
                <Typography variant="body1" color="text.secondary">
                  {slug}
                </Typography>
                {delegate ? (
                  <Row gap={0.3}>
                    <AddressIcon
                      address={delegate.address}
                      size={IconSize.xs}
                    />
                    <Typography>{trimAddress(delegate.address)}</Typography>
                  </Row>
                ) : (
                  <Typography color="text.secondary">--</Typography>
                )}
              </Row>
            </Stack>
          </Stack>
          <Button onClick={show}>Delegate</Button>
        </Stack>
      </Card>
      {open && <DelegateDialog open={open} onClose={hide} />}
    </>
  );
};
export default DelegatesCard;
