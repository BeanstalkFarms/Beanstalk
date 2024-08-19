import React, { useEffect, useRef, useState } from 'react';

import { Box, Stack, Typography } from '@mui/material';
import { Dimensions } from '~/hooks/display/useElementDimensions';
import { useSpring, animated } from 'react-spring';
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
  const boxRefs = useRef<HTMLDivElement[]>([]);
  const [dimensions, setDimensions] = useState<Dimensions[]>([]);

  const selectedIdx = options.findIndex((option) => option.value === selected);

  useEffect(() => {
    const refDimensions: Dimensions[] = boxRefs.current.map((ref) => {
      const _dimensions = ref.getBoundingClientRect();
      return {
        width: _dimensions.width,
        height: _dimensions.height,
      };
    });
    setDimensions(refDimensions);
  }, []);

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
