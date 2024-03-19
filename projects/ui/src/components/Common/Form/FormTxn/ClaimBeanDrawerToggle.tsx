import { Card, Stack, Typography } from '@mui/material';
import { useFormikContext } from 'formik';
import React, { useMemo } from 'react';
import { IconSize } from '~/components/App/muiTheme';
import { FormTxnsFormState } from '..';
import Row from '../../Row';

import podIconGrey from '~/img/beanstalk/pod-icon-grey.svg';
import podIconGreen from '~/img/beanstalk/pod-icon-green.svg';

import sproutsIconGrey from '~/img/beanstalk/sprout-icon-grey.svg';
import sproutsIconGreen from '~/img/beanstalk/rinsable-sprout-icon.svg';

import IconWrapper from '~/components/Common/IconWrapper';
import Centered from '~/components/Common/ZeroState/Centered';
import useFarmerFormTxnsSummary, {
  FormTxnOptionSummary,
} from '~/hooks/farmer/form-txn/useFarmerFormTxnsSummary';

import MergeIcon from '~/img/misc/merge-icon.svg';
import SelectionItem from '~/components/Common/SelectionItem';
import FormWithDrawer, {
  useFormDrawerContext,
} from '~/components/Common/Form/FormWithDrawer';
import { FormTxn, FormTxnBundler, FormTxnMap } from '~/lib/Txn';

const actionsToIconMap = {
  [FormTxn.RINSE]: {
    selected: sproutsIconGreen,
    grey: sproutsIconGrey,
  },
  [FormTxn.HARVEST]: {
    selected: podIconGreen,
    grey: podIconGrey,
  },
};

const ClaimBeanDrawerToggle: React.FC<{ actionText?: string }> = ({ actionText }) => {
  /// Formik
  const { values } = useFormikContext<FormTxnsFormState>();

  /// Form Drawer Context state
  const { setOpen: setDrawerOpen } = useFormDrawerContext();

  /// Farmer
  const { summary, getClaimable } = useFarmerFormTxnsSummary();

  /// Derived
  const preset = values.farmActions.preset;
  const formSelections = values.farmActions.primary;

  const optionsMap = useMemo(() => {
    const options = FormTxnBundler.presets[preset].primary;
    return options.reduce<Partial<FormTxnMap<FormTxnOptionSummary>>>(
      (prev, curr) => {
        prev[curr] = summary[curr].summary[0];
        return prev;
      },
      {}
    );
  }, [preset, summary]);

  const maxClaimable = useMemo(
    () => getClaimable(FormTxnBundler.presets[preset].primary).bn,
    [getClaimable, preset]
  );

  const selectionsSet = useMemo(
    () => new Set(formSelections || []),
    [formSelections]
  );

  if (preset !== 'claim' || maxClaimable.lte(0)) return null;

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
              {`${actionText || 'Use'} Claimable Beans`}
            </Typography>
            <Typography variant="bodySmall" color="text.tertiary">
              Select additional assets to use in this transaction.
            </Typography>
          </Stack>
        </Row>
        <Row gap={1}>
          <Row gap={0.5}>
            {Object.entries(optionsMap).map(([k, info]) => {
              const selected = selectionsSet.has(k as FormTxn);
              const disabled = info.amount.lte(0);
              const _key = k as keyof typeof actionsToIconMap;
              const icons = actionsToIconMap[_key];

              return (
                <SelectionItem
                  key={k}
                  variant="circle"
                  selected={selected}
                  disabled={disabled}
                  onClick={setDrawerOpen}
                  backgroundOnHover={false}
                >
                  <IconWrapper
                    boxSize={IconSize.small}
                    maxWidth={IconSize.small}
                    maxHeight={IconSize.small}
                  >
                    <Centered sx={{ p: 0.3, boxSizing: 'border-box' }}>
                      <img
                        src={selected ? icons.selected : icons.grey}
                        alt={info.token.symbol}
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
