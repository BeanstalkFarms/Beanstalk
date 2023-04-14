import React, { useCallback, useEffect, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { useFormikContext } from 'formik';
import { Box, Grid, Typography } from '@mui/material';
import useToggle from '~/hooks/display/useToggle';
import { displayBN, MaxBN, MinBN , PlotMap } from '~/util';
import PlotSelectDialog from '~/components/Field/PlotSelectDialog';
import useHarvestableIndex from '~/hooks/beanstalk/useHarvestableIndex';
import { PODS } from '~/constants/tokens';

import { ZERO_BN } from '~/constants';
import { PlotFragment, PlotSettingsFragment, TokenAdornment, TokenInputField } from '.';
import AdvancedButton from './AdvancedButton';
import SliderField from './SliderField';
import Row from '~/components/Common/Row';

import { FC } from '~/types';
import { TokenInputProps } from '~/components/Common/Form/TokenInputField';

const SLIDER_FIELD_KEYS = ['plot.start', 'plot.end'];
const InputPropsLeft  = { endAdornment: 'Start' };
const InputPropsRight = { endAdornment: 'End' };

const PlotInputField : FC<{
  /** All plots that are selectable via the input field */
  plots: PlotMap<BigNumber>,
  /** The maximum number of pods that can be entered into the input */
  max?: BigNumber;
  /** */
  disabledAdvanced?: boolean;
} & TokenInputProps> = ({
  plots,
  max,
  disabledAdvanced = false,
  ...props
}) => {
  /// Form state
  const { values, setFieldValue, isSubmitting } = useFormikContext<{ 
    /// These fields are required in the parent's Formik state
    plot: PlotFragment,
    settings: PlotSettingsFragment,
  }>();

  /// Local state
  const [dialogOpen, showDialog, hideDialog] = useToggle();

  /// Data
  const harvestableIndex = useHarvestableIndex();
  
  /// Find the currently selected plot from form state.
  /// If selected, grab the number of pods from the farmer's field state.
  const plot = values.plot;
  const [numPods, numPodsFloat] = useMemo(
    () => {
      if (!plot.index) return [ZERO_BN, 0];
      const _pods = plots[plot.index];
      return [_pods, _pods.toNumber()];
    },
    [plots, plot.index]
  );

  /// Button to select a new plot
  const InputProps = useMemo(() => ({
    endAdornment: (
      <TokenAdornment
        token={PODS}
        onClick={showDialog}
        buttonLabel={(
          plot.index ? (
            <Row gap={0.75}>
              <Typography display="inline" fontSize={16}>@</Typography>
              {displayBN(new BigNumber(plot.index).minus(harvestableIndex))}
            </Row>
          ) : 'Select Plot'
        )}
        size={props.size}
      />
    ),
  }), [harvestableIndex, plot.index, showDialog, props.size]);

  /// "Advanced" control in the Quote slot
  const Quote = useMemo(() => (disabledAdvanced ? undefined : (
    <AdvancedButton
      open={values.settings.showRangeSelect}
      onClick={() => setFieldValue(
        'settings.showRangeSelect',
        !values.settings.showRangeSelect
      )}
    />
  )), [disabledAdvanced, setFieldValue, values.settings.showRangeSelect]);

  /// Clamp 
  const clamp = useCallback((amount: BigNumber | undefined) => {
    if (!amount) return undefined;
    if (amount.lt(0)) return ZERO_BN;
    if (max && amount.gt(max)) return max;
    return amount;
  }, [max]);

  /// Update `start` and `end` based on `amount`
  const onChangeAmount = useCallback((amount: BigNumber | undefined) => {
    if (!amount) {
      /// If the user clears the amount input, set start/end to the end
      /// of the Plot; amount will get set to zero by below effect
      setFieldValue('plot.start', numPods);
      setFieldValue('plot.end',   numPods);
    } else {
      /// Expand the plot plot range assuming that the right handle is fixed:
      ///
      /// plot                              start     end     amount    next action
      /// -----------------------------------------------------------------------------------
      /// 0 [     |---------|     ] 1000    300       600     300       increase amount by 150
      /// 0 [  |------------|     ] 1000    150       600     450       increase amount by 300
      /// 0 [------------------|  ] 1000    0         750     750       increase amount by 150
      /// 0 [---------------------] 1000    0         1000    1000      reached maximum amount
      const delta = (plot?.end || ZERO_BN).minus(amount);
      setFieldValue('plot.start', MaxBN(ZERO_BN, delta));
      if (delta.lt(0)) {
        setFieldValue('plot.end', MinBN(numPods, (plot?.end || ZERO_BN).plus(delta.abs())));
      }
    }
  }, [numPods, plot?.end, setFieldValue]);

  /// Select a new plot
  const handlePlotSelect = useCallback((index: string) => {
    const numPodsClamped  = clamp(new BigNumber(plots[index]));
    setFieldValue('plot.amount', numPodsClamped);
    setFieldValue('plot.index',  index);  
    // set start/end directly since `onChangeAmount` depends on the current `plot`   
    setFieldValue('plot.start',  ZERO_BN);
    setFieldValue('plot.end',    numPodsClamped);
  }, [clamp, plots, setFieldValue]);

  /// Update amount when an endpoint changes via the advanced controls
  /// If one of end/start change, so does the amount input.
  /// Values are changed when the slider moves or a manual input changes.
  useEffect(() => {
    const clampedAmount = clamp(plot.end?.minus(plot.start || ZERO_BN));
    setFieldValue('plot.amount', clampedAmount);
  }, [setFieldValue, plot.end, plot.start, clamp]);

  return (
    <>
      <PlotSelectDialog
        plots={plots}
        harvestableIndex={harvestableIndex}
        handlePlotSelect={handlePlotSelect}
        handleClose={hideDialog}
        selected={plot.index}
        open={dialogOpen}
      />
      <TokenInputField
        name="plot.amount"
        fullWidth
        max={max}
        InputProps={InputProps}
        balance={numPods}
        hideBalance={!plot.index}
        balanceLabel={plot.index ? 'Plot Size' : undefined}
        onChange={onChangeAmount}
        quote={plot.index ? Quote : undefined}
        {...props}
      />
      {values.settings.showRangeSelect && (
        <>
          <Box px={1}>
            <SliderField
              min={0}
              max={numPodsFloat}
              fields={SLIDER_FIELD_KEYS}
              initialState={[
                /// The slider is re-initialized whenever this
                /// section gets re-rendered.
                plot.start?.toNumber() || 0,
                plot.end?.toNumber()   || numPodsFloat,
              ]}
              disabled={isSubmitting}
              // changeMode="onChangeCommitted"
            />
          </Box>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <TokenInputField
                name="plot.start"
                placeholder="0.0000"
                max={numPods}
                InputProps={InputPropsLeft}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TokenInputField
                name="plot.end"
                placeholder="0.0000"
                max={numPods} 
                InputProps={InputPropsRight}
                size="small"
              />
            </Grid>
          </Grid>
        </>
      )}
    </>
  );
};

export default PlotInputField;
