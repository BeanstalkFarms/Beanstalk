import { Slider, SliderProps } from '@mui/material';
import BigNumber from 'bignumber.js';
import { atom, PrimitiveAtom, useAtom, useAtomValue } from 'jotai';
import React, { useCallback } from 'react';
import { ZERO_BN } from '~/constants';

type AtomSliderConfig = {
  start: PrimitiveAtom<BigNumber | null>;
  end?: PrimitiveAtom<BigNumber | null>;
  maxAtom: PrimitiveAtom<BigNumber | null>;
  minDistance?: number;
  setValue?: (vals: (BigNumber | null)[]) => void;
};

const stableAtom = atom<BigNumber | null>(ZERO_BN);

const AtomSliderField: React.FC<AtomSliderConfig & SliderProps> = ({
  start: _start,
  end: _end,
  maxAtom,
  minDistance = 1,
  setValue,
  ...props
}) => {
  const [start, setStart] = useAtom(_start);
  const [end, setEnd] = useAtom(_end || stableAtom);
  const maxValue = useAtomValue(maxAtom);

  const handleChange = useCallback(
    (_event: Event, newValue: number | number[], activeThumb: number) => {
      if (!Array.isArray(newValue)) {
        return;
      }

      if (activeThumb === 0) {
        setStart(
          new BigNumber(Math.min(newValue[0], newValue[1] - minDistance))
        );
      } else {
        setEnd(new BigNumber(Math.max(newValue[1], newValue[0] + minDistance)));
      }
      setValue?.([start, end]);
    },
    [minDistance, start, end, setEnd, setStart, setValue]
  );

  return (
    <Slider
      color="primary"
      min={0}
      max={maxValue?.toNumber() || 100}
      value={
        end
          ? [
              start?.toNumber() || 0,
              end?.toNumber() || maxValue?.toNumber() || 100,
            ]
          : [start?.toNumber() || 0]
      }
      onChange={handleChange}
      valueLabelDisplay="auto"
      {...props}
      disableSwap // never enable swap
    />
  );
};

export default AtomSliderField;
