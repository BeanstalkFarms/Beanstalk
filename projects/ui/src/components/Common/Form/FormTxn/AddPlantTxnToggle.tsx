import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Card,
  Grid,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useFormikContext } from 'formik';
import { displayFullBN } from '~/util';
import {
  BeanstalkPalette,
  FontSize,
  FontWeight,
} from '~/components/App/muiTheme';
import TokenIcon from '~/components/Common/TokenIcon';
import Row from '~/components/Common/Row';

import useToggle from '~/hooks/display/useToggle';
import useFarmerFormTxnsSummary from '~/hooks/farmer/form-txn/useFarmerFormTxnsSummary';
import MergeIcon from '~/img/misc/merge-icon.svg';

import { FormTxnsFormState } from '..';
import { FormTxn } from '~/lib/Txn';

const sx = {
  accordion: {
    backgroundColor: 'primary.light',
    borderRadius: 1,
    '&.MuiAccordion-root:before': {
      backgroundColor: 'primary.light',
    },
  },
  accordionSummary: {
    '&.MuiAccordionSummary-root': {
      '&:hover': {
        /// only enable cursor on the switch component
        cursor: 'default',
      },
    },
  },
} as const;

/**
 * Used to add 'plant' to the formState (FormTxnsFormState)
 * If nothing to 'plant' or if the preset is not 'plant', returns null
 *
 * NOTE: Used within Formik Context
 */
const AddPlantTxnToggle: React.FC<{}> = () => {
  /// Local State
  const [open, show, hide] = useToggle();

  /// Formik
  const { values, setFieldValue } = useFormikContext<FormTxnsFormState>();
  const { preset, primary } = values.farmActions;

  /// Plant Summary and State
  const { summary } = useFarmerFormTxnsSummary();

  const items = useMemo(() => {
    const plant = summary[FormTxn.PLANT].summary;
    const mow = summary[FormTxn.MOW].summary;
    return [...plant, ...mow];
  }, [summary]);

  /// Derived
  const isPlant = preset === 'plant';
  const plantEnabled = summary[FormTxn.PLANT].enabled;
  const isPlanting = Boolean(primary?.includes(FormTxn.PLANT));

  /// Handlers
  const handleToggleOn = useCallback(() => {
    if (isPlant) {
      setFieldValue('farmActions.primary', [FormTxn.PLANT]);
      show();
    }
  }, [isPlant, setFieldValue, show]);

  const handleToggleOff = useCallback(() => {
    if (isPlant) {
      setFieldValue('farmActions.primary', []);
      hide();
    }
  }, [hide, isPlant, setFieldValue]);

  /// Effects
  /// Update the local state if the Form State is updated externally
  useEffect(() => {
    if (isPlant && isPlanting && !open) {
      show();
    } else if (open && (!isPlant || !isPlanting)) {
      hide();
    }
  }, [open, isPlant, isPlanting, show, hide]);

  /// If there is nothing to plant or if the preset isn't plant, return nothing
  if (!isPlant || !plantEnabled) return null;

  return (
    <Accordion
      expanded={open}
      defaultExpanded={false}
      defaultChecked={false}
      sx={sx.accordion}
    >
      <AccordionSummary sx={sx.accordionSummary}>
        <Row justifyContent="space-between" alignItems="center" width="100%">
          <Row
            gap={1}
            alignItems="center"
            /// only enable the switch component to toggle
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={MergeIcon}
              alt="merge"
              css={{ width: '24px', height: '24px' }}
            />
            <Stack>
              <Typography variant="h4" color="primary.main">
                Use Earned Beans
              </Typography>
              <Typography variant="body1" color="text.tertiary">
                Toggle to claim Earned Beans in your transaction
              </Typography>
            </Stack>
          </Row>
          <Switch
            checked={open}
            onClick={(e) => {
              e.stopPropagation();
              open ? handleToggleOff() : handleToggleOn();
            }}
            color="primary"
          />
        </Row>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 1 }}>
        <Card
          sx={{
            background: BeanstalkPalette.honeydewGreen,
            borderColor: 'primary.light',
          }}
        >
          <Stack gap={1} p={1}>
            <Typography variant="body1" color="text.tertiary">
              You will Plant to claim these silo rewards
            </Typography>
            <Grid container spacing={1} direction="row">
              {items.map((item, i) => (
                <Grid item xs={6} sm={3} key={`${item.token.symbol}-${i}`}>
                  <Card sx={{ border: 0, width: '100%', background: 'white' }}>
                    <Stack gap={0.2} p={1}>
                      <Row gap={0.2}>
                        <TokenIcon
                          token={item.token}
                          css={{ height: FontSize.sm }}
                        />
                        <Typography
                          variant="bodySmall"
                          fontWeight={FontWeight.semiBold}
                        >
                          {displayFullBN(item.amount, 2)}
                        </Typography>
                      </Row>
                      <Typography
                        variant="bodySmall"
                        fontWeight={FontWeight.normal}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        {item.description}
                      </Typography>
                    </Stack>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Card>
      </AccordionDetails>
    </Accordion>
  );
};

export default AddPlantTxnToggle;
