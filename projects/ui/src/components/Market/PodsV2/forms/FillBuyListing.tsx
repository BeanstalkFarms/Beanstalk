/* eslint-disable */
import { InputAdornment, Slider, Stack, Typography } from '@mui/material';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { atom, useAtom, useSetAtom } from 'jotai';
import BigNumber from 'bignumber.js';
import PlaceInLineSlider from '../Common/PlaceInLineSlider';
import { AppState } from '~/state';
import useToggle from '~/hooks/display/useToggle';
import {
  placeInLineAtom,
  selectedPlotAmountAtom,
  selectedPlotAtom, selectedPlotEndAtom,
  selectedPlotStartAtom
} from '~/components/Market/PodsV2/info/atom-context';
import useHarvestableIndex from '~/hooks/beanstalk/useHarvestableIndex';
import { ZERO_BN } from '~/constants';
import { TokenAdornment } from '~/components/Common/Form';
import { PODS } from '~/constants/tokens';
import { displayBN } from '~/util';
import AtomInputField from '~/components/Common/Atom/AtomInputField';
import PlotSelectDialog from '~/components/Field/PlotSelectDialog';
import Row from '~/components/Common/Row';

const SelectPlotField: React.FC<{}> = () => {
  // State
  const plots = useSelector<AppState, AppState['_farmer']['field']['plots']>(
    (state) => state._farmer.field.plots
  );
  const [open, setOpen, close] = useToggle();
  const [selectedPlot, setSelectedPlot] = useAtom(selectedPlotAtom);
  const harvestableIndex = useHarvestableIndex();

  /// Clamp
  const clamp = useCallback((amount: BigNumber | undefined) => {
    if (!amount) return null;
    if (amount.lt(0)) return ZERO_BN;
    return amount;
  }, []);

  const handlePlotSelect = useCallback(
    (index: string) => {
      console.log('index: ', index);
      const numPodsClamped = clamp(new BigNumber(plots[index]));
      setSelectedPlot({
        index,
        amount: numPodsClamped,
        start: ZERO_BN,
        end: numPodsClamped,
      });
      console.log('numpodsclamped: ', numPodsClamped?.toNumber());
    },
    [clamp, plots, setSelectedPlot]
  );

  // max amount of pods for selected plot
  const maxAtom = useMemo(
    () =>
      atom(
        selectedPlot?.index ? new BigNumber(plots[selectedPlot.index]) : null
      ),
    [plots, selectedPlot?.index]
  );

  const InputProps = useMemo(
    () => ({
      endAdornment: (
        <TokenAdornment
          token={PODS}
          onClick={setOpen}
          iconSize="xs"
          downArrowIconSize="small"
          buttonLabel={
            selectedPlot?.index ? (
              <Typography variant="caption">
                {`@ ${displayBN(
                  new BigNumber(selectedPlot.index).minus(harvestableIndex)
                )}`}
              </Typography>
            ) : (
              <Typography variant="caption">Select Plot</Typography>
            )
          }
        />
      ),
      startAdornment: (
        <InputAdornment position="start">
          <Typography variant="caption" color="text.primary">
            AMOUNT
          </Typography>
        </InputAdornment>
      ),
    }),
    [harvestableIndex, selectedPlot?.index, setOpen]
  );

  return (
    <>
      <AtomInputField
        atom={selectedPlotAmountAtom}
        InputProps={InputProps}
        amountString="PlotSize"
        maxValueAtom={maxAtom}
        showMax
      />
      <PlotSelectDialog
        open={open}
        harvestableIndex={harvestableIndex}
        handlePlotSelect={handlePlotSelect}
        handleClose={close}
        plots={plots}
        selected={selectedPlot?.index}
      />
    </>
  );
};

const minSliderDistance = 1;
const SelectedPlotSlider: React.FC<{}> = () => {
  const plots = useSelector<AppState, AppState['_farmer']['field']['plots']>(
    (state) => state._farmer.field.plots
  );
  const [selectedPlot, setSelectedPlot] = useAtom(selectedPlotAtom);
  const setPlaceInLine = useSetAtom(placeInLineAtom);

  const [start, setStart] = useAtom(selectedPlotStartAtom);
  const [end, setEnd] = useAtom(selectedPlotEndAtom);
  const [amount, setAmount] = useAtom(selectedPlotAmountAtom);
  const harvestableIndex = useHarvestableIndex();

  const handleChange = useCallback(
    (_e: Event, newValue: number | number[], activeThumb: number) => {
      if (!Array.isArray(newValue)) {
        return;
      }
      if (activeThumb === 0) {
        setStart(
          new BigNumber(Math.min(newValue[0], newValue[1] - minSliderDistance))
        );
      } else {
        setEnd(
          new BigNumber(Math.max(newValue[1], newValue[0] + minSliderDistance))
        );
      }
      setAmount(end && start ? end.minus(start) : null);
    },
    [end, start, setAmount, setEnd, setStart]
  );

  useEffect(() => {
    if (selectedPlot?.index) {
      console.log('selectedPLot?.index: ', selectedPlot?.index);
      console.log('place in line: ', plots[selectedPlot?.index]?.toNumber());
      setPlaceInLine(new BigNumber(selectedPlot.index).minus(harvestableIndex));
    }
  }, [harvestableIndex, plots, selectedPlot, setPlaceInLine]);

  if (!selectedPlot?.index) return null;

  return (
    <Stack px={0.8}>
      <Stack px={2}>
        <Slider
          color="primary"
          min={0}
          max={new BigNumber(plots[selectedPlot?.index]).toNumber() || 100}
          value={[start?.toNumber() || 0, end?.toNumber() || 100]}
          onChange={handleChange}
          disableSwap
          size="small"
          sx={{
            color: 'primary.main',
            height: '8px',
            '& .MuiSlider-thumb': {
              width: '20px',
              height: '20px',
              boxShadow: 'none',
              boxSizing: 'border-box',
              background: '#fff',
              border: '2.5px solid currentColor',
              '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
                boxShadow: 'inherit',
              },
            },
          }}
        />
      </Stack>
      <Row gap={0.8} width="100%" justifyContent="space-between">
        <AtomInputField
          atom={selectedPlotStartAtom}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Typography variant="caption" color="text.primary">
                  START
                </Typography>
              </InputAdornment>
            ),
          }}
        />
        <AtomInputField
          atom={selectedPlotEndAtom}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Typography variant="caption" color="text.primary">
                  END
                </Typography>
              </InputAdornment>
            ),
          }}
        />
      </Row>
    </Stack>
  );
};

const FillBuyListing: React.FC<{}> = () => (
  <Stack>
    <Stack p={0.8} gap={0.8}>
      {/* <SubActionSelect /> */}
      <SelectPlotField />
      <SelectedPlotSlider />
      <Stack px={1.6} gap={0.8}>
        <PlaceInLineSlider canSlide={false} />
      </Stack>
    </Stack>
  </Stack>
  );
export default FillBuyListing;
