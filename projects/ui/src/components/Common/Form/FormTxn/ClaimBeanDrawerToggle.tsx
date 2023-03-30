import { Box, Button, Card, Stack, Typography } from '@mui/material';
import { useFormikContext } from 'formik';
import React, { useCallback, useMemo } from 'react';
import { IconSize } from '~/components/App/muiTheme';
import { FormTxn, FormTxnBuilderPresets } from '~/util';
import { FormTxnsFormState } from '..';
import Row from '../../Row';
import FormWithDrawer from '../FormWithDrawer';

import podIconGrey from '~/img/beanstalk/pod-icon-grey.svg';
import podIconGreen from '~/img/beanstalk/pod-icon-green.svg';

import sproutsIconGrey from '~/img/beanstalk/sprout-icon-grey.svg';
import sproutsIconGreen from '~/img/beanstalk/sprout-icon-green.svg';

import beanIconGreen from '~/img/tokens/bean-logo-circled-wintergreen.svg';
import beanIconGrey from '~/img/tokens/bean-logo-circled-grey.svg';
import IconWrapper from '~/components/Common/IconWrapper';
import Centered from '~/components/Common/ZeroState/Centered';
import useFarmerFormTxnsSummary, {
  FormTxnOptionSummary,
} from '~/hooks/farmer/form-txn/useFarmerFormTxnsSummary';

import MergeIcon from '~/img/misc/merge-icon.svg';
import SelectionItem from '../../SelectionItem';
import BigNumber from 'bignumber.js';
import { ZERO_BN } from '~/constants';

const actionsToIconMap = {
  [FormTxn.RINSE]: {
    selected: sproutsIconGreen,
    grey: sproutsIconGrey,
  },
  [FormTxn.HARVEST]: {
    selected: podIconGreen,
    grey: podIconGrey,
  },
  [FormTxn.CLAIM]: {
    selected: beanIconGreen,
    grey: beanIconGrey,
  },
};

const ClaimBeanDrawerToggle: React.FC<{ maxBeans?: BigNumber }> = ({
  maxBeans,
}) => {
  /// Formik
  const { values, setFieldValue } = useFormikContext<FormTxnsFormState>();

  /// Farmer
  const { summary, getClaimable } = useFarmerFormTxnsSummary();

  /// Derived
  const preset = values.farmActions.preset;
  const formSelections = values.farmActions.primary;

  const optionsMap = useMemo(() => {
    const options = FormTxnBuilderPresets[preset].primary;
    return options.reduce<Partial<{ [key in FormTxn]: FormTxnOptionSummary }>>(
      (prev, curr) => {
        prev[curr] = summary[curr].summary[0];
        return prev;
      },
      {}
    );
  }, [preset, summary]);

  /// Form State
  const selectionSet = useMemo(() => {
    return new Set(formSelections || []);
  }, [formSelections]);

  /// Derived
  const maxClaimable = useMemo(() => {
    const amount = getClaimable(
      FormTxnBuilderPresets[values.farmActions.preset].primary
    );
    return amount.bn;
  }, [values.farmActions.preset, getClaimable]);

  const clamp = useCallback(
    (_amount: BigNumber) => {
      if (maxBeans) {
        return BigNumber.min(maxClaimable, maxBeans);
      }
      return _amount;
    },
    [maxClaimable, maxBeans]
  );

  const handleToggle = useCallback(
    (option: FormTxn) => {
      const _selected = new Set(selectionSet);
      if (_selected.has(option)) {
        _selected.delete(option);
      } else {
        _selected.add(option);
      }
      const amount = getClaimable([..._selected]).bn;

      setFieldValue('farmActions.primary', Array.from(_selected));
      setFieldValue('farmActions.additionalAmount', clamp(amount));
    },
    [selectionSet, clamp, setFieldValue]
  );

  /// if nothing to claim, return null
  if (!maxClaimable.gt(0)) {
    return null;
  }

  return (
    <Card
      sx={{
        backgroundColor: 'primary.light',
        borderColor: 'primary.light',
      }}
    >
      <Row
        gap={1}
        p={1}
        justifyContent="space-between"
        alignItems="center"
        width="100%"
      >
        <Row gap={1}>
          <img
            src={MergeIcon}
            alt="merge"
            css={{ width: '24px', height: '24px' }}
          />
          <Stack>
            <Typography variant="h4" color="primary.main">
              Use Claimable Assets
            </Typography>
            <Typography variant="bodySmall" color="text.tertiary">
              Select assets to use in this transaction
            </Typography>
          </Stack>
        </Row>
        <Row gap={1}>
          <Row gap={0.5}>
            {Object.entries(optionsMap).map(([k, info]) => {
              const selected = selectionSet.has(k as FormTxn);
              const disabled = info.amount.lte(0);
              const _key = k as keyof typeof actionsToIconMap;
              const icons = actionsToIconMap[_key];

              return (
                <SelectionItem
                  selected={selected}
                  disabled={disabled}
                  onClick={() => handleToggle(k as FormTxn)}
                  sx={{ borderRadius: '50%' }}
                  stackProps={{ sx: { p: 0 } }}
                >
                  <IconWrapper
                    boxSize={IconSize.small}
                    maxWidth={IconSize.small}
                    maxHeight={IconSize.small}
                  >
                    <Centered sx={{ p: 0.3, boxSizing: 'border-box' }}>
                      <img
                        src={selected ? icons.selected : icons.grey}
                        css={{
                          width: '100%',
                          height: '100%',
                        }}
                      />
                    </Centered>
                  </IconWrapper>
                </SelectionItem>
              );
            })}
          </Row>
          <FormWithDrawer.Toggle />
        </Row>
      </Row>
    </Card>
  );
};

export default ClaimBeanDrawerToggle;
