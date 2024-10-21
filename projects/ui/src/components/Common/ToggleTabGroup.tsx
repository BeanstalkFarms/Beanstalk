import React, { useEffect, useRef, useState } from 'react';

import { Box, Stack, Typography } from '@mui/material';
import { Dimensions } from '~/hooks/display/useElementDimensions';
import { useSpring, animated } from 'react-spring';
import useIsMounted from '~/hooks/display/useIsMounted';
import { BeanstalkPalette, FontWeight } from '../App/muiTheme';

export type ToggleTabGroupProps<T extends string | number> = {
  selected: T;
  setSelected: (selected: T) => void;
  options: {
    label: string;
    value: T;
  }[];
  gap?: number;
  tabPadding?: {
    px?: number;
    py?: number;
  };
};

const ToggleTabGroup = <T extends string | number>({
  selected,
  setSelected,
  options,
  gap = 1,
  tabPadding = { px: 3, py: 0.75 },
}: ToggleTabGroupProps<T>) => {
  const mounted = useIsMounted();
  const boxRefs = useRef<HTMLDivElement[]>([]);
  const [dimensions, setDimensions] = useState<Dimensions[]>([]);

  const selectedIdx = options.findIndex((option) => option.value === selected);

  const numOptions = options.length;

  useEffect(() => {
    const observe = () => {
      const observers: ResizeObserver[] = [];

      boxRefs.current.forEach((div, index) => {
        if (div) {
          const observer = new ResizeObserver((entries) => {
            entries.forEach((_) => {
              const { width, height } = div.getBoundingClientRect();
              setDimensions((prevSizes) => {
                const newSizes = [...prevSizes];
                newSizes[index] = { width, height };
                return newSizes;
              });
            });
          });

          observer.observe(div);
          observers.push(observer);
        }
      });

      return observers;
    };

    const observers = observe();

    // Cleanup function to disconnect observers
    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [numOptions]);

  const width = dimensions[selectedIdx]?.width || 0;
  const height = dimensions[selectedIdx]?.height || 0;
  const space = gap * 10;

  const leftPosition = dimensions
    .slice(0, selectedIdx)
    .reduce((acc, dim, i) => acc + dim.width + (i + 1) * space, 0);

  const spring = useSpring({
    to: {
      width: `${width}px`,
      left: `${leftPosition + selectedIdx + space}px`,
    },
    config: {
      tension: 175,
      friction: 20,
      mass: 1,
      clamp: true,
    },
    immediate: !mounted.current.valueOf(),
  });

  return (
    <Stack position="relative" p={1}>
      <Stack gap={gap} direction="row" position="relative" sx={{ zIndex: 10 }}>
        {options.map(({ label, value }, i) => {
          const isSelected = selected === value;
          return (
            <Box
              key={value}
              ref={(el: HTMLDivElement) => {
                boxRefs.current[i] = el;
              }}
              sx={{
                zIndex: 1,
                cursor: 'pointer',
                userSelect: 'none',
                ...tabPadding,
              }}
              onClick={() => setSelected(value)}
            >
              <Typography
                variant="subtitle1"
                fontWeight={FontWeight.medium}
                color={isSelected ? 'text.primary' : 'text.secondary'}
                sx={{ textAlign: 'center' }}
              >
                {label}
              </Typography>
            </Box>
          );
        })}
      </Stack>
      <Box
        component={animated.div}
        style={spring}
        sx={{
          position: 'absolute',
          width: width,
          height: height,
          backgroundColor: BeanstalkPalette.lighterBlue,
          border: `1px solid ${BeanstalkPalette.blue}`,
          borderRadius: '5px',
          zIndex: 0,
        }}
      />
    </Stack>
  );
};
export default ToggleTabGroup;
