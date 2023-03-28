import React, { useCallback } from 'react';
import {
  MenuItem,
  SelectProps,
  SelectChangeEvent,
  Select,
  Box,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { FontSize } from '../App/muiTheme';

type ISelectProps = Omit<SelectProps, 'value' | 'onChange' | 'multiple'>;
type TSelect = string | number;

export type ISelectionGroup<T extends TSelect> = {
  value: T;
  options: T[];
  setValue: React.Dispatch<React.SetStateAction<T>>;
  fontSize?: keyof typeof FontSize;
};

const selectionGroupStyles = {
  '& .MuiOutlinedInput-notchedOutline': {
    outline: '1px',
    borderColor: 'divider',
  },
  '& .MuiSelect-nativeInput': {
    borderWidth: '1px',
    borderColor: 'primary.main',
  },
  '& .MuiInputBase-input': {
    paddingLeft: 1,
    paddingTop: 0.5,
    paddingBottom: 0.5,
    border: '1px solid',
    borderRadius: '4px',
    borderColor: 'divider',
  },
  '& .MuiOutlinedInput-root': {
    borderRadius: '4px',
  },
  '& .MuiSelect-icon': {
    fontSize: 'inherit',
    color: 'text.primary',
  },
};

export default function SingleSelectionGroup<T extends TSelect>({
  value,
  options,
  setValue,
  size = 'small',
  fontSize,
  ...props
}: ISelectionGroup<T> & ISelectProps) {
  const handleOnChange = useCallback(
    (event: SelectChangeEvent<unknown>) => {
      setValue(event.target.value as T);
    },
    [setValue]
  );

  return (
    <Box sx={selectionGroupStyles}>
      <Select
        color="primary"
        size={size}
        value={value}
        onChange={handleOnChange}
        multiple={false}
        IconComponent={ExpandMoreIcon}
        {...props}
        sx={{
          ...props.sx,
          fontSize: fontSize ? FontSize[fontSize] : undefined,
        }}
      >
        {options.map((opt) => (
          <MenuItem
            key={opt.toString()}
            value={opt}
            sx={{
              minWidth: 'unset',
              fontSize: fontSize ? FontSize[fontSize] : undefined,
            }}
          >
            {opt.toString()}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}
