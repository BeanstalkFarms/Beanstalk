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
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  BeanstalkPalette,
  FontWeight,
  IconSize,
} from '~/components/App/muiTheme';
import TokenSelectionCard from '~/components/Common/Card/TokenSelectionCard';
import Row from '~/components/Common/Row';
import SelectionItem from '~/components/Common/SelectionItem';
import { ZERO_BN } from '~/constants';
import useFarmerFormTxnsSummary, {
  FormTxnOptionSummary,
} from '~/hooks/farmer/form-txn/useFarmerFormTxnsSummary';
import useSdk from '~/hooks/sdk';
import { FormTxn, FormTxnBuilderPresets, PartialFormTxnMap } from '~/util';
import { FormTxnsFormState, TokenAdornment, TokenInputField } from '..';

import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AddressIcon from '../../AddressIcon';

import BigNumber from 'bignumber.js';

// if 'maxBeans' property is defined, require 'beanAmount' to be defined
export type ClaimBeanDrawerContentProps =
  | {
      txnName?: string;
      /**
       * the maximum amount of beans that can be used
       */
      maxBeans?: BigNumber;
      /**
       * the estimated amount of beans from the token input
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

const toModeOptions = [
  {
    key: FarmToMode.INTERNAL,
    icon: <>{'🚜'}</>,
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

const ClaimBeanDrawerContent: React.FC<ClaimBeanDrawerContentProps> = ({
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
  const formSelections = values.farmActions.primary;
  const destination = farmActions.surplus?.destination || FarmToMode.INTERNAL;
  const additionalAmount = farmActions.additionalAmount || ZERO_BN;

  ///
  const optionsMap = useMemo(() => {
    const options = FormTxnBuilderPresets[preset].primary;
    return options.reduce((prev, curr) => {
      prev[curr] = summary[curr].summary[0];
      return prev;
    }, {} as PartialFormTxnMap<FormTxnOptionSummary>);
  }, [preset, summary]);

  const selectionsSet = useMemo(() => {
    return new Set(formSelections);
  }, [formSelections]);

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
    [selectionsSet, additionalAmount, getClaimable, setFieldValue]
  );

  const handleSetDestination = useCallback(
    (_toMode: FarmToMode) => {
      if (_toMode === destination) return;
      setFieldValue('farmActions.surplus.destination', _toMode);
    },
    [destination, setFieldValue]
  );

  const claimAmount = useMemo(() => {
    return getClaimable([...selectionsSet]).bn;
  }, [selectionsSet, getClaimable]);

  const maxClaimableBeansUsable = useMemo(() => {
    if (maxBeans) {
      const remainingAmount = maxBeans.minus(beanAmount);
      return BigNumber.max(remainingAmount, ZERO_BN);
    }
    return claimAmount;
  }, [claimAmount, maxBeans, beanAmount]);

  const inputDisabled = claimAmount.lte(0) || maxClaimableBeansUsable.lte(0);
  const transferrable = claimAmount.minus(additionalAmount);

  /// Effects
  /// update the additional amount if it is greater than the max claimable beans
  useEffect(() => {
    if (maxClaimableBeansUsable.lt(additionalAmount)) {
      setFieldValue('farmActions.additionalAmount', maxClaimableBeansUsable);
    }
  }, [maxClaimableBeansUsable, claimAmount, additionalAmount, setFieldValue]);

  /// Render
  const InputProps = useMemo(() => {
    return {
      endAdornment: <TokenAdornment token={sdk.tokens.BEAN} />,
    };
  }, [sdk.tokens.BEAN]);

  return (
    <Stack gap={1}>
      <Card
        sx={{
          background: BeanstalkPalette.honeydewGreen,
          borderColor: 'primary.light',
        }}
      >
        <Stack gap={1} p={1}>
          <Typography variant="body1" color="text.tertiary">
            Which assets do you want to Claim?
          </Typography>
          <Stack gap={1} direction={{ xs: 'column', sm: 'row' }}>
            {Object.entries(optionsMap).map(([k, item]) => (
              <TokenSelectionCard
                key={item.token.symbol}
                token={item.token}
                amount={item.amount}
                selected={selectionsSet.has(k as FormTxn)}
                onClick={() => handleToggle(k as FormTxn)}
                disabled={item.amount.lte(0)}
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
      <Card
        sx={{
          background: BeanstalkPalette.honeydewGreen,
          borderColor: 'primary.light',
        }}
      >
        <Stack gap={1} p={1}>
          <Typography variant="body1" color="text.tertiary">
            Amount of Claimable Beans to use {txnName ? `in ${txnName}` : ''}
          </Typography>
          <TokenInputField
            /// Formik
            name={'farmActions.additionalAmount'}
            /// MUI
            disabled={inputDisabled}
            fullWidth
            InputProps={InputProps}
            // Other
            balance={claimAmount}
            balanceLabel={isMobile ? 'Balance' : 'Claimable Bean Balance'}
            token={sdk.tokens.BEAN}
            max={maxClaimableBeansUsable}
            hideBalance={false}
          />
        </Stack>
      </Card>

      {/* Transfer claimable beans not being used */}
      {transferrable?.gt(0) && (
        <Card
          sx={{
            background: BeanstalkPalette.honeydewGreen,
            borderColor: 'primary.light',
            width: '100%',
          }}
        >
          <Stack gap={1} p={1}>
            <Typography variant="body1" color="text.tertiary">
              You're using less than your total Claimable Beans in this
              transaciton. Where do you want to send the remainer?
            </Typography>
            <Stack gap={1}>
              {toModeOptions.map((opt) => {
                const selected = opt.key === destination;
                return (
                  <SelectionItem
                    key={opt.key}
                    title={
                      <Typography
                        variant="body1"
                        component="span"
                        color={selected ? 'text.primary' : 'text.secondary'}
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
                    selected={selected}
                    onClick={() => handleSetDestination(opt.key)}
                    checkIcon="top-right"
                    gap={0}
                  >
                    <Stack alignItems="flex-start">
                      <Typography
                        variant="bodySmall"
                        color={selected ? 'text.primary' : 'text.secondary'}
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
      )}
    </Stack>
  );
};

export default ClaimBeanDrawerContent;
