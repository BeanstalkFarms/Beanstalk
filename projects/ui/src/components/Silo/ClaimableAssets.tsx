import React, { useState } from 'react';
import { Stack, Switch, Tooltip, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import useFarmerClaimableAssets, {
  FarmerClaimableAsset,
} from '~/hooks/farmer/useFarmerClaimableAssets';
import Row from '../Common/Row';
import TokenSelectionCard from '../Common/Selection/TokenSelectionCard';
import { AddressMap } from '~/constants';

const ClaimableAssets: React.FC<{}> = () => {
  const claimable = useFarmerClaimableAssets();
  const [selected, setSelected] = useState<AddressMap<FarmerClaimableAsset>>(
    {}
  );

  const handleToggle = (data: FarmerClaimableAsset) => {
    const key = data.token.symbol;
    if (key in selected) {
      setSelected((prev) => {
        delete prev[key];
        return { ...prev };
      });
    } else {
      setSelected((prev) => ({ ...prev, [key]: data }));
    }
  };

  const areAllSelected = Object.keys(claimable).every((key) => selected[key]);

  return (
    <Stack gap={1} width="100%">
      <Row width="100%" justifyContent="space-between">
        <Typography variant="h4">
          Claimable Assets{' '}
          <Tooltip
            title="tooltip data goes here" // TODO FIX ME
            placement="right"
          >
            <HelpOutlineIcon
              sx={{
                color: 'text.secondary',
                display: 'inline',
                mb: 0.5,
                fontSize: '11px',
              }}
            />
          </Tooltip>
        </Typography>
        <Row>
          <Typography>Claim all</Typography>
          <Switch
            checked={areAllSelected}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setSelected(e.target.checked ? { ...claimable } : {});
            }}
          />
        </Row>
      </Row>
      <Stack gap={1} width="100%" direction={{ xs: 'column', sm: 'row' }}>
        {Object.entries(claimable).map(([k, data]) => (
          <TokenSelectionCard
            key={k}
            token={data.token}
            amount={data.amount}
            title={data.description}
            selected={k in selected}
            toggle={() => handleToggle(data)}
          />
        ))}
      </Stack>
    </Stack>
  );
};
export default ClaimableAssets;
