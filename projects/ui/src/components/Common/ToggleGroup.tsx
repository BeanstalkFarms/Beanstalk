import React from 'react';
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  ToggleButtonGroupProps,
} from '@mui/material';
import {
  BeanstalkPalette,
  hexToRgba,
  FontSize,
  FontWeight,
} from '../App/muiTheme';

export type IToggleGroup<T extends string | number> = ToggleButtonGroupProps & {
  options: {
    label: string | JSX.Element;
    value: T;
  }[];
  fontSize?: keyof typeof FontSize;
};

const selectedBG = BeanstalkPalette.theme.winter.primary;

export default function ToggleGroup<T extends string | number>({
  options,
  fontSize = 'sm',
  exclusive = true,
  size = 'medium',
  ...props
}: IToggleGroup<T>) {
  return (
    <Box
      sx={{
        '& .MuiToggleButtonGroup-root': {
          borderRadius: '4px',
          border: '1px solid',
          borderColor: 'divider',
        },
        '& .MuiToggleButtonGroup-grouped': {
          ':not(:first-of-type)': {
            marginLeft: 0,
            borderLeft: 0,
          },
        },
        '& .MuiToggleButton-root': {
          borderRadius: '4px',
          color: 'text.primary',
          border: 0,
          borderColor: 'divider',
          fontWeight: FontWeight.normal,
          padding: 0,
          margin: 0,
          fontSize: FontSize[fontSize],
          background: 'none',
          '&.Mui-selected:hover': {
            background: 'none',
          },
          ':hover': {
            background: 'none',
          },
        },
      }}
    >
      <ToggleButtonGroup {...props} exclusive={exclusive} size={size}>
        {options.map(({ label, value: _value }, i) => {
          const isActive = props.value === _value;
          const isFirst = i === 0;
          return (
            <ToggleButton
              key={label.toString()}
              value={_value}
              size={size}
              disableRipple
              disableFocusRipple
            >
              <Box
                py="2px"
                pr="2px"
                pl={isFirst ? '2px' : 0}
                sx={{ background: 'transparent' }}
              >
                <Box
                  py="2px"
                  px="4px"
                  sx={{
                    borderRadius: '4px',
                    background: isActive ? selectedBG : 'transparent',
                    ':hover': {
                      background: isActive
                        ? BeanstalkPalette.theme.winter.primaryDark
                        : hexToRgba(selectedBG, 0.2),
                    },
                  }}
                >
                  {label}
                </Box>
              </Box>
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
    </Box>
  );
}
