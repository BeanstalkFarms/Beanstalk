import React, { useMemo } from 'react';
import { Stack, Switch, Tooltip, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useFormikContext } from 'formik';
import { ClaimableBeanToken } from '~/hooks/farmer/useFarmerClaimableBeanAssets';
import Row from '../Common/Row';
import TokenSelectionCard from '~/components/Common/Card/TokenSelectionCard';
import { displayFullBN } from '~/util';
import SidelineAlert from '../Common/Alert/SidelineAlert';
import {
  ClaimableBeanAssetFragment,
  FarmWithClaimFormState,
  FormState,
} from '../Common/Form';
import { ZERO_BN } from '~/constants';
import { FarmerBalances } from '~/state/farmer/balances';
import FarmModeField from '../Common/Form/FarmModeField';
import EmbeddedCard from '../Common/EmbeddedCard';
import { BEAN } from '~/constants/tokens';
import { balanceFromLabels } from '../Common/Form/BalanceFromRow';

const FIELD_VALUE = 'beansClaiming' as const;

const uiDescriptions = {
  [ClaimableBeanToken.SPROUTS]: 'Rinsable Sprouts',
  [ClaimableBeanToken.BEAN]: 'Claimable Beans',
  [ClaimableBeanToken.PODS]: 'Harvestable Pods',
} as const;

const ClaimableAssets: React.FC<{
  balances: Record<string, ClaimableBeanAssetFragment>;
  farmerBalances: FarmerBalances;
}> = ({ balances, farmerBalances }) => {
  const { values, setFieldValue } = useFormikContext<FormState & FarmWithClaimFormState>();

  const { assetsWithBalance, allSelected, totalClaiming, disabled } = useMemo(() => {
    const _disabled = Object.values(balances).every((v) => v.amount.lte(0));
    const _totalClaiming = Object.values(values.beansClaiming).reduce(
      (prev, curr) => {
        if (curr?.amount?.gt(0)) prev = prev.plus(curr.amount);
        return prev;
      },
      ZERO_BN
    );
    const _assetsWithBalance = Object.entries(balances).reduce(
      (prev, [k, v]) => {
        if (v.amount?.gt(0)) prev[k] = v;
        return prev;
      },
      {} as Record<string, ClaimableBeanAssetFragment>
    );
    const _allSelected = Object.keys(_assetsWithBalance).every(
      (k) => values.beansClaiming[k]
    );

    return {
      assetsWithBalance: _assetsWithBalance,
      allSelected: _allSelected,
      disabled: _disabled,
      totalClaiming: _totalClaiming,
    };
  }, [balances, values.beansClaiming]);

  const surplus = useMemo(() => {
    const data = values.tokens[0] || undefined;
    if (totalClaiming.eq(0) || !data) return ZERO_BN;
    // this is only correct if claimed beans are used first
    if (data.token === BEAN[1] && data.amount?.lt(totalClaiming)) {
      return totalClaiming.minus(data.amount || ZERO_BN);
    }
    return totalClaiming;
  }, [totalClaiming, values.tokens]);

  // component state functions
  const handleToggle = (
    key: ClaimableBeanToken,
    data: ClaimableBeanAssetFragment
  ) => {
    if (key in values.beansClaiming) {
      const copy = { ...values.beansClaiming };
      delete copy[key];
      if (!Object.keys(copy).length) {
        setFieldValue('destination', undefined);
      }
      setFieldValue(FIELD_VALUE, copy);
    } else {
      setFieldValue(FIELD_VALUE, {
        ...values.beansClaiming,
        [key]: data as ClaimableBeanAssetFragment,
      });
    }
  };

  const handleToggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFieldValue(FIELD_VALUE, {
      ...(e.target.checked ? assetsWithBalance : {}),
    });
    if (!e.target.checked) {
      setFieldValue('destination', undefined);
    }
  };

  return (
    <EmbeddedCard sx={{ p: 1.5, borderRadius: 1 }}>
      <Stack gap={1} width="100%">
        {/* *Title */}
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
        {/* *Alert */}
        <SidelineAlert color="success" hide={totalClaiming.lte(0)}>
          <Typography
            color="text.primary"
            variant="bodySmall"
            sx={{ whitespace: 'nowrap' }}
        >
            <Typography component="span" variant="caption" fontWeight="bold">
              + {displayFullBN(totalClaiming, 2)}
            </Typography>{' '}
            <Typography component="span" variant="inherit">
              Beans applied to use on your{' '}
            </Typography>
            <Typography component="span" variant="inherit" fontStyle="italic" sx={{ textTransform: 'capitalize' }}>
              {/* TODO FIX ME TO BE DYNAMIC */}
              {balanceFromLabels[values.balanceFrom]} Balance
            </Typography>
          </Typography>
        </SidelineAlert>
        {/* *Selection Cards */}
        <Stack gap={1} width="100%" direction={{ xs: 'column', sm: 'row' }}>
          {Object.entries(balances).map(([k, data]) => (
            <TokenSelectionCard
              disabled={data.amount.lte(0)}
              key={k}
              token={data.token}
              amount={data.amount}
              title={uiDescriptions[k as ClaimableBeanToken]}
              selected={k in values.beansClaiming}
              toggle={() => handleToggle(k as ClaimableBeanToken, data)}
          />
        ))}
        </Stack>
        {/* FIX ME */}
        {surplus && surplus?.gt(0) 
        ? <FarmModeField 
            name="destination"
            infoLabel={
              <Typography>
                Send remaining{' '} 
                <Typography component="span" color="primary.main">
                  {displayFullBN(surplus, 2)} BEAN{' '}
                </Typography>
                to..
              </Typography>
            } 
          />
        : null}
      </Stack>
    </EmbeddedCard>
  );
};
export default ClaimableAssets;
