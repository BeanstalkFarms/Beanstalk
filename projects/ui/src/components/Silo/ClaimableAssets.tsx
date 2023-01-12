import React, { useMemo, useState } from 'react';
import { Stack, Switch, Tooltip, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import useFarmerClaimableAssets, {
  ClaimableBeanToken,
  FarmerClaimableBeanAsset,
} from '~/hooks/farmer/useFarmerClaimableBeanAssets';
import Row from '../Common/Row';
import TokenSelectionCard from '~/components/Common/Card/TokenSelectionCard';
import { displayFullBN } from '~/util';
import SidelineAlert from '../Common/Alert/SidelineAlert';

const uiDescriptions = {
  [ClaimableBeanToken.SPROUTS]: 'Rinsable Sprouts',
  [ClaimableBeanToken.BEAN]: 'Claimable Beans',
  [ClaimableBeanToken.PODS]: 'Harvestable Pods',
} as const;

const ClaimableAssets: React.FC<{}> = () => {
  // global state
  const { total: totalClaimable, assets: claimable } =
    useFarmerClaimableAssets();

  // local state
  const [selected, setSelected] = useState<Record<string, FarmerClaimableBeanAsset>>({});

  // claimable assets map with a balance gt 0
  const assetsWithBalance = useMemo(() => {
    const arr = Object.entries(claimable);
    return arr.reduce<Record<string, FarmerClaimableBeanAsset>>((prev, [k, v]) => {
      if (v.amount?.gt(0)) prev[k] = v;
      return prev;
    }, {});
  }, [claimable]);

  // component state functions
  const handleToggle = (key: ClaimableBeanToken,data: FarmerClaimableBeanAsset) => {
    if (key in selected) {
      setSelected((prev) => {
        delete prev[key];
        return { ...prev };
      });
    } else {
      setSelected((prev) => ({ ...prev, [key]: data }));
    }
  };

  const handleToggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelected({ ...(e.target.checked ? assetsWithBalance : {}) });
  };

  // component state
  const allSelected = Object.keys(assetsWithBalance).every((k) => selected[k]);
  const disabled = Object.values(claimable).every((v) => v.amount.lte(0));

  return (
    <Stack gap={1} width="100%">
      {/*
       *Title
       */}
      <Row width="100%" justifyContent="space-between">
        <Typography variant="h4">
          Claimable Assets
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
          <Typography color={disabled ? 'text.disabled' : 'text.primary'}>
            Claim all
          </Typography>
          <Switch
            checked={allSelected || false}
            disabled={disabled}
            onChange={handleToggleAll}
          />
        </Row>
      </Row>
      {/*
       *Alert
       */}
      <SidelineAlert color="success" hide={totalClaimable?.lte(0)}>
        <Typography
          color="text.primary"
          variant="bodySmall"
          sx={{ whitespace: 'nowrap' }}
        >
          <Typography component="span" variant="caption" fontWeight="bold">
            + {displayFullBN(totalClaimable, 2)}
          </Typography>{' '}
          <Typography component="span" variant="inherit">
            Beans applied to use on your{' '}
          </Typography>
          <Typography component="span" variant="inherit" fontStyle="italic">
            Farm balance
          </Typography>
        </Typography>
      </SidelineAlert>
      {/*
       *Selection Cards
       */}
      <Stack gap={1} width="100%" direction={{ xs: 'column', sm: 'row' }}>
        {Object.entries(claimable).map(([k, data]) => (
          <TokenSelectionCard
            disabled={data.amount.lte(0)}
            key={k}
            token={data.token}
            amount={data.amount}
            title={uiDescriptions[k as ClaimableBeanToken]}
            selected={k in selected}
            toggle={() => handleToggle(k as ClaimableBeanToken, data)}
          />
        ))}
      </Stack>
    </Stack>
  );
};
export default ClaimableAssets;
