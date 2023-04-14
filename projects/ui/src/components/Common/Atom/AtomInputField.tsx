import { TextFieldProps, TextField, Typography, Stack } from '@mui/material';
import BigNumber from 'bignumber.js';
import {
  atom,
  PrimitiveAtom,
  SetStateAction,
  useAtom,
  useAtomValue,
  WritableAtom,
} from 'jotai';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontSize } from '~/components/App/muiTheme';
import { formSubmittingAtom } from '~/components/Market/PodsV2/info/atom-context';
import { ZERO_BN } from '~/constants';
import { displayFullBN } from '~/util';
import NumberFormatInput from '../Form/NumberFormatInput';

export type WritableAtomType<T> = WritableAtom<T, SetStateAction<T>, void>;

export type AtomInputFieldCustomProps = {
  /**
   * The atom to be used for the input field
   */
  atom: WritableAtomType<BigNumber | null>;
  /**
   * disable the input of the field
   */
  disableInput?: boolean;
  /**
   * maximum value of the input
   */
  maxValueAtom?: PrimitiveAtom<BigNumber | null>;
  /**
   * minimum value of the input
   */
  min?: BigNumber;
  /**
   *
   */
  textAlign?: 'left' | 'right';
  /**
   * show & enable the set max functionality
   */
  showMax?: boolean;
  /**
   * the label of the set max amount
   */
  amountString?: string;
  /**
   * bubble up the value to parent if necessary
   */
  onChange?: (v: BigNumber | null) => void;
};

export type AtomInputFieldProps = AtomInputFieldCustomProps &
  Partial<Omit<TextFieldProps, 'onChange'>>;

const baseMaxAtom = atom<BigNumber | null>(null);

const AtomInputField: React.FC<AtomInputFieldProps> = ({
  atom: _atom, // rename to avoid conflict w/ atom import
  textAlign = 'right',
  disableInput,
  maxValueAtom,
  min = ZERO_BN,
  showMax = false,
  amountString = 'amount',
  placeholder = '0',
  onChange,
  ...props
}) => {
  const max = useAtomValue(maxValueAtom || baseMaxAtom);
  const isSubmitting = useAtomValue(formSubmittingAtom);
  const [value, setValue] = useAtom(_atom);
  const [displayAmount, setDisplayAmount] = useState<string>(
    value ? value?.toString() : ''
  );

  const inputProps = useMemo(
    () =>
      ({
        inputProps: {
          min: 0.0,
          inputMode: 'numeric',
        },
        inputComponent: NumberFormatInput as any,
        ...props.InputProps,
      } as TextFieldProps['InputProps']),
    [props.InputProps]
  );

  const clamp = useCallback(
    (amount: BigNumber | null) => {
      if (!amount) return null;
      if (max && max?.lt(amount)) return max;
      if (min && min?.gt(amount)) return min;
      return amount;
    },
    [max, min]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (disableInput) {
        e.preventDefault();
        return;
      }
      const newValue = e.target.value ? new BigNumber(e.target.value) : null;
      setDisplayAmount(newValue?.toString() || '');

      if (newValue === null || !value || !newValue.eq(value)) {
        const clamped = clamp(newValue);
        setValue(clamped);
        onChange?.(clamped);
      }
    },
    [clamp, onChange, setValue, value, disableInput]
  );

  const handleMax = useCallback(() => {
    if (showMax && max) {
      const clamped = clamp(max);
      setValue(clamped);
      onChange?.(clamped);
    }
  }, [clamp, max, onChange, setValue, showMax]);

  const isDisabled = props.disabled || (max && max.eq(0)) || isSubmitting;

  useEffect(() => {
    if (!value) {
      if (displayAmount !== '') {
        setDisplayAmount('');
      }
    } else if (value.toString() !== displayAmount) {
      setDisplayAmount(value.toString());
    }
  }, [value, displayAmount]);

  // Ignore scroll events on the input. Prevents
  // accidentally scrolling up/down the number input.
  const handleWheel = useCallback((e: any) => {
    // @ts-ignore
    e.target.blur();
  }, []);

  return (
    <Stack gap={0.4} width="100%">
      <TextField
        type="text"
        placeholder={placeholder || '0'}
        value={displayAmount || ''}
        fullWidth
        {...props}
        size="small"
        disabled={isDisabled}
        onChange={handleChange}
        onWheel={handleWheel}
        InputProps={inputProps}
        sx={{
          borderRadius: 0.6,
          '& .MuiOutlinedInput-root': {
            px: '8px',
          },
          '& .MuiInputAdornment-root': {
            mr: '0px !important',
            ml: '0px !important',
          },
          '& .MuiInputBase-input': {
            px: props?.InputProps?.endAdornment ? '4px' : '8px',
            py: '12px',
            minHeight: 0,
            textAlign: textAlign,
            fontSize: FontSize.xs,
            '&.Mui-disabled': {
              color: 'text.tertiary',
            },
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderRadius: '6px',
          },
          ...props.sx,
        }}
      />
      {maxValueAtom && showMax ? (
        <Typography
          variant="caption"
          color="text.primary"
          component="span"
          textAlign="right"
        >
          {amountString}: {displayFullBN(max || ZERO_BN, 2)}
          <Typography
            display="inline"
            color="primary.main"
            variant="caption"
            sx={{ ml: 0.2, cursor: 'pointer' }}
            onClick={handleMax}
          >
            (max)
          </Typography>
        </Typography>
      ) : null}
    </Stack>
  );
};
export default AtomInputField;
