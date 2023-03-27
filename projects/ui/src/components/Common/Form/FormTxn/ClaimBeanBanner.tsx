import { Box, Card, Stack, Typography } from '@mui/material';
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
import useFarmerFormTxnsSummary from '~/hooks/farmer/form-txn/useFarmerFormTxnsSummary';

import MergeIcon from '~/img/misc/merge-icon.svg';

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

const ClaimBeanBanner: React.FC<{}> = () => {
  /// Formik
  const { values, setFieldValue } = useFormikContext<FormTxnsFormState>();

  /// Farmer
  const { getClaimable } = useFarmerFormTxnsSummary();

  /// Form State
  const selectionSet = useMemo(() => {
    return new Set(values.farmActions.primary || []);
  }, [values.farmActions.primary]);

  /// Derived
  const maxClaimable = useMemo(() => {
    const amount = getClaimable(
      FormTxnBuilderPresets[values.farmActions.preset].primary
    );
    return amount.bn;
  }, [values.farmActions.preset, getClaimable]);

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
      setFieldValue('farmActions.additionalAmount', amount);
    },
    [selectionSet, setFieldValue]
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
            css={{
              width: '24px',
              height: '24px',
            }}
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
            {Object.entries(actionsToIconMap).map(([k, v]) => {
              const selected = selectionSet.has(k as FormTxn);
              return (
                <Box
                  sx={{
                    borderRadius: '50%',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: selected ? 'primary.main' : 'text.tertiary',
                  }}
                  onClick={() => handleToggle(k as FormTxn)}
                >
                  <IconWrapper
                    boxSize={IconSize.small}
                    maxWidth={IconSize.small}
                    maxHeight={IconSize.small}
                  >
                    <Centered
                      sx={{
                        p: 0.3,
                        boxSizing: 'border-box',
                      }}
                    >
                      <img
                        src={selected ? v.selected : v.grey}
                        css={{
                          width: '100%',
                          height: '100%',
                        }}
                      />
                    </Centered>
                  </IconWrapper>
                </Box>
              );
            })}
          </Row>
          <FormWithDrawer.Toggle />
        </Row>
      </Row>
    </Card>
  );
};

export default ClaimBeanBanner;
