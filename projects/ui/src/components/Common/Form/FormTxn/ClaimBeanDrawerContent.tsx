import {
  Stack,
  Card,
  Typography,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useFormikContext } from 'formik';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BeanstalkPalette, IconSize } from '~/components/App/muiTheme';
import useFarmerFormTxnsSummary, {
  FormTxnOptionSummary,
} from '~/hooks/farmer/form-txn/useFarmerFormTxnsSummary';
import { FormTxn, FormTxnBuilderPresets } from '~/util';
import { FormTxnsFormState, TokenAdornment, TokenInputField } from '..';
import TokenSelectionCard from '../../Card/TokenSelectionCard';
import { ZERO_BN } from '~/constants';
import useSdk from '~/hooks/sdk';
import Row from '../../Row';
import { FarmToMode } from '@beanstalk/sdk';
import AddressIcon from '../../AddressIcon';
import SelectionItem from '../../SelectionItem';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

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

const ClaimBeanDrawerContent: React.FC<{
  mainTxn?: string;
}> = ({ mainTxn }) => {
  ///
  const sdk = useSdk();

  /// Formik
  const { values, setFieldValue } = useFormikContext<FormTxnsFormState>();

  /// Summary
  const { summary } = useFarmerFormTxnsSummary();

  const preset = values.farmActions.preset;
  const formSelections = values.farmActions.primary;
  const toMode = values.farmActions.surplusTo || FarmToMode.INTERNAL;

  /// Derived
  const optionsMap = useMemo(() => {
    const map: Partial<{ [key in FormTxn]: FormTxnOptionSummary }> = {};
    const _options = FormTxnBuilderPresets[preset].primary;
    _options.forEach((item) => {
      // claimable assets only have 1 item in the summary
      map[item] = summary[item].summary[0];
    });

    return map;
  }, [preset, summary]);

  const selectionsSet = useMemo(() => {
    return new Set(formSelections);
  }, [formSelections]);

  const maxAmount = useMemo(() => {
    const _maxAmount = Object.entries(optionsMap).reduce((acc, [k, item]) => {
      if (selectionsSet.has(k as FormTxn)) {
        acc = acc.plus(item.amount);
      }
      return acc;
    }, ZERO_BN);
    return _maxAmount?.gt(0) ? _maxAmount : ZERO_BN;
  }, [selectionsSet]);

  const additionalAmount = values.farmActions.additionalAmount || ZERO_BN;
  const surplus = maxAmount?.gt(0)
    ? maxAmount.minus(additionalAmount)
    : ZERO_BN;

  const handleToggle = useCallback(
    (option: FormTxn) => {
      const copy = new Set(selectionsSet);
      if (copy.has(option)) {
        copy.delete(option);
      } else {
        copy.add(option);
      }

      setFieldValue('farmActions.primary', Array.from(copy));
    },
    [selectionsSet, setFieldValue]
  );

  const handleSetDestination = useCallback(
    (toMode: FarmToMode) => {
      setFieldValue('farmActions.surplusTo', toMode);
    },
    [setFieldValue]
  );

  /// update additional amount if it exceeds max
  useEffect(() => {
    if (maxAmount) {
      if (additionalAmount.gt(maxAmount)) {
        setFieldValue('farmActions.additionalAmount', maxAmount);
      }
    } else if (!maxAmount && additionalAmount.gt(0)) {
      setFieldValue('farmActions.additionalAmount', undefined);
    }
  }, [additionalAmount, maxAmount]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (values.farmActions.preset !== 'claim') {
    return null;
  }

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
                toggle={() => handleToggle(k as FormTxn)}
              />
            ))}
          </Stack>
        </Stack>
      </Card>

      <Card
        sx={{
          background: BeanstalkPalette.honeydewGreen,
          borderColor: 'primary.light',
        }}
      >
        <Stack gap={1} p={1}>
          <Typography variant="body1" color="text.tertiary">
            Amount of Claimable Beans to use {mainTxn ? `in ${mainTxn}` : ''}
          </Typography>
          <TokenInputField
            disabled={maxAmount?.lte(0)}
            name={'farmActions.additionalAmount'}
            fullWidth
            balance={maxAmount}
            balanceLabel={isMobile ? 'Balance' : 'Claimable Bean Balance'}
            token={sdk.tokens.BEAN}
            InputProps={{
              endAdornment: <TokenAdornment token={sdk.tokens.BEAN} />,
            }}
            hideBalance={false}
            max={maxAmount}
          />
        </Stack>
      </Card>
      {/* ) : null} */}
      {surplus?.gt(0) && (
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
                const selected = opt.key === toMode;

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
