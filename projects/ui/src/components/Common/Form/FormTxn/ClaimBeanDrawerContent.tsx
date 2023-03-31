import React, { useCallback, useMemo } from 'react';
import { FarmToMode } from '@beanstalk/sdk';
import {
  Card,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useFormikContext } from 'formik';
import BigNumber from 'bignumber.js';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { ZERO_BN } from '~/constants';
import {
  BeanstalkPalette,
  FontWeight,
  IconSize,
} from '~/components/App/muiTheme';
import TokenSelectionCard from '~/components/Common/Card/TokenSelectionCard';
import useFarmerFormTxnsSummary, {
  FormTxnOptionSummary,
} from '~/hooks/farmer/form-txn/useFarmerFormTxnsSummary';
import useSdk from '~/hooks/sdk';
import { FormTxn, FormTxnBuilderPresets, PartialFormTxnMap } from '~/util';
import {
  FormTxnsFormState,
  TokenAdornment,
  TokenInputField,
} from '~/components/Common/Form';
import SelectionItem from '~/components/Common/SelectionItem';
import AddressIcon from '~/components/Common/AddressIcon';
import Row from '~/components/Common/Row';

// if 'maxBeans' property is defined, require 'beanAmount' to be defined
export type ClaimBeanInfoProps =
  | {
      txnName?: string;
      /**
       * the maximum amount of beans that can be used
       */
      maxBeans?: BigNumber;
      /**
       * the estimated amount of beans used from the primary token input
       */
      beanAmount: BigNumber;
    }
  | {
      /** */
      txnName?: string;
      /** */
      maxBeans?: undefined;
      /** */
      beanAmount?: undefined;
    };

const FAKE_TOOLTIP = 'fake tooltip';

const sharedCardProps = {
  sx: {
    background: BeanstalkPalette.honeydewGreen,
    borderColor: 'primary.light',
  },
} as const;

const toModeOptions = [
  {
    key: FarmToMode.INTERNAL,
    icon: <>🚜</>,
    name: 'Farm',
    content: 'Claim to Farm Balance by default. Does not cost extra gas',
    tooltip: FAKE_TOOLTIP,
  },
  {
    key: FarmToMode.EXTERNAL,
    icon: (
      <AddressIcon
        size={IconSize.small}
        width={IconSize.small}
        height={IconSize.small}
      />
    ),
    name: 'Circulating',
    content: 'Transfer remainder to your wallet. Costs extra in gas',
    tooltip: FAKE_TOOLTIP,
  },
];

const ClaimBeanDrawerContent: React.FC<ClaimBeanInfoProps> = ({
  txnName,
  maxBeans,
  beanAmount,
}) => {
  ///
  const sdk = useSdk();

  /// @MUI
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  /// Formik
  const { values, setFieldValue } = useFormikContext<FormTxnsFormState>();
  const { farmActions } = values;

  /// Summary
  const { summary, getClaimable } = useFarmerFormTxnsSummary();

  /// Form values
  const preset = values.farmActions.preset;
  const destination = farmActions.surplus?.destination || FarmToMode.INTERNAL;
  const additionalAmount = farmActions.additionalAmount || ZERO_BN;

  /// Derived
  const optionsMap = useMemo(() => {
    const options = FormTxnBuilderPresets[preset].primary;
    return options.reduce((prev, curr) => {
      prev[curr] = summary[curr].summary[0];
      return prev;
    }, {} as PartialFormTxnMap<FormTxnOptionSummary>);
  }, [preset, summary]);

  const selectionsSet = useMemo(
    () => new Set(values.farmActions.primary || []),
    [values.farmActions.primary]
  );

  const claimAmount = useMemo(
    () => getClaimable([...selectionsSet]).bn,
    [selectionsSet, getClaimable]
  );

  const maxClaimableBeansUsable = useMemo(() => {
    if (maxBeans) {
      const remainingAmount = maxBeans.minus(beanAmount);
      return BigNumber.max(remainingAmount, ZERO_BN);
    }
    return claimAmount;
  }, [claimAmount, maxBeans, beanAmount]);

  const inputDisabled = claimAmount.lte(0) || maxClaimableBeansUsable.lte(0);
  const transferrable = claimAmount.minus(additionalAmount);

  /// Handlers
  const handleToggle = useCallback(
    (option: FormTxn) => {
      const copy = new Set(selectionsSet);
      if (copy.has(option)) copy.delete(option);
      else copy.add(option);

      const newSelections = [...copy];
      const newClaimAmount = getClaimable(newSelections).bn;

      setFieldValue('farmActions.primary', newSelections);
      setFieldValue('farmActions.surplus.max', newClaimAmount);

      if (newClaimAmount.lt(additionalAmount)) {
        setFieldValue('farmActions.additionalAmount', newClaimAmount);
      }
    },
    [selectionsSet, getClaimable, setFieldValue, additionalAmount]
  );

  const handleSetDestination = useCallback(
    (_toMode: FarmToMode) => {
      if (_toMode === destination) return;
      setFieldValue('farmActions.surplus.destination', _toMode);
    },
    [destination, setFieldValue]
  );

  return (
    <Stack gap={1}>
      <Card {...sharedCardProps}>
        <Stack gap={1} p={1}>
          <Typography variant="body1" color="text.tertiary">
            Which assets do you want to Claim?
          </Typography>
          <Stack gap={1} direction={{ xs: 'column', sm: 'row' }}>
            {Object.entries(optionsMap).map(([k, item]) => (
              <TokenSelectionCard
                key={k}
                token={item.token}
                amount={item.amount}
                selected={selectionsSet.has(k as FormTxn)}
                onClick={() => handleToggle(k as FormTxn)}
                disabled={item.amount.lte(0)}
                backgroundOnHover={false}
              >
                <Stack>
                  <Typography
                    variant="bodySmall"
                    fontWeight={FontWeight.normal}
                    sx={{ whiteSpace: 'nowrap' }}
                    alignSelf="flex-start"
                  >
                    {item.description}
                  </Typography>
                </Stack>
              </TokenSelectionCard>
            ))}
          </Stack>
        </Stack>
      </Card>
      {/* Input Field */}
      {claimAmount.gt(0) ? (
        <Card {...sharedCardProps}>
          <Stack gap={1} p={1}>
            <Typography variant="body1" color="text.tertiary">
              Amount of Claimable Beans to use {txnName ? `in ${txnName}` : ''}
            </Typography>
            <TokenInputField
              /// Formik
              name="farmActions.additionalAmount"
              /// MUI
              disabled={inputDisabled}
              fullWidth
              InputProps={{
                endAdornment: <TokenAdornment token={sdk.tokens.BEAN} />,
              }}
              // Other
              balance={claimAmount}
              balanceLabel={isMobile ? 'Balance' : 'Claimable Bean Balance'}
              token={sdk.tokens.BEAN}
              max={maxClaimableBeansUsable}
              hideBalance={false}
            />
          </Stack>
        </Card>
      ) : null}
      {/* Transfer claimable beans not being used */}
      {transferrable.gt(0) ? (
        <Card {...sharedCardProps}>
          <Stack gap={1} p={1}>
            <Typography variant="body1" color="text.tertiary">
              You&apos;re using less than your total Claimable Beans in this
              transaciton. Where do you want to send the remainer?
            </Typography>
            <Stack gap={1}>
              {toModeOptions.map((opt) => {
                const isSelected = opt.key === destination;
                return (
                  <SelectionItem
                    key={opt.key.toString()}
                    title={
                      <Typography
                        variant="body1"
                        component="span"
                        color={isSelected ? 'text.primary' : 'text.secondary'}
                      >
                        <Row gap={0.5}>
                          {opt.icon}
                          <Typography variant="inherit" color="inherit">
                            {opt.name} Balance
                            <Tooltip title={opt.tooltip}>
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
                        </Row>
                      </Typography>
                    }
                    selected={isSelected}
                    onClick={() => handleSetDestination(opt.key)}
                    checkIcon="top-right"
                    backgroundOnHover={false}
                    gap={0}
                  >
                    <Stack alignItems="flex-start">
                      <Typography
                        variant="bodySmall"
                        color={isSelected ? 'text.primary' : 'text.secondary'}
                      >
                        {opt.content}
                      </Typography>
                    </Stack>
                  </SelectionItem>
                );
              })}
            </Stack>
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
};

export default ClaimBeanDrawerContent;
