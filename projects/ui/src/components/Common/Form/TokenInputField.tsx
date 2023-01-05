import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Divider,
  TextField,
  TextFieldProps,
  Tooltip,
  Typography,
} from '@mui/material';
import { Field, FieldProps } from 'formik';
import BigNumber from 'bignumber.js';

import Token from '~/classes/Token';
import { displayBN, displayFullBN, displayTokenAmount } from '~/util';
import { FarmerBalances } from '~/state/farmer/balances';
import NumberFormatInput from './NumberFormatInput';
import FieldWrapper from './FieldWrapper';
import Row from '~/components/Common/Row';
import { FC } from '~/types';
import { ZERO_BN } from '~/constants';

export type TokenInputCustomProps = {
  /**
   * If provided, the Balance is displayed with respect
   * to this token's displayDecimals.
   */
  token?: Token;
  /**
   *
   */
  balance?: FarmerBalances[string] | BigNumber | undefined;
  /**
   *
   */
  balanceLabel?: string;
  /**
   * 
   */
  max?: BigNumber | 'use-balance';
  /**
   *
   */
  min?: BigNumber;
  /**
   * 
   */
  hideBalance?: boolean;
  /**
   *
   */
  quote?: JSX.Element;
  /**
   *
   */
  allowNegative?: boolean;
  /**
   * 
   */
  onChange?: (finalValue: BigNumber | undefined) => void;
};

// const preventNegative = (e: React.)

export type TokenInputProps = (
  TokenInputCustomProps // custom
  & Partial<Omit<TextFieldProps, 'onChange'>>  // MUI TextField
);

export const VALID_INPUTS = /[0-9]*/;

export const preventNegativeInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === '-') {
    e.preventDefault();
  }
};

const TokenInput: FC<
  TokenInputProps & FieldProps
> = ({
  /// Balances
  token,
  balance: _balance,
  balanceLabel = 'Balance',
  hideBalance = false,
  quote,
  max: _max = 'use-balance',
  min,
  allowNegative = false,
  /// Formik props
  field,
  form,
  /// TextField props
  onChange,
  placeholder,
  disabled,
  sx,
  InputProps,
  label,
  ...textFieldProps
}) => {
  const [displayAmount, setDisplayAmount] = useState<string>(field.value?.toString() || '');
  const inputProps = useMemo(() => ({
    inputProps: {
      min: 0.00,
      inputMode: 'numeric',
    },
    inputComponent: NumberFormatInput as any,
    ...InputProps,
  } as TextFieldProps['InputProps']), [InputProps]);

  // Unpack balance
  const [balance, balanceTooltip] = useMemo(() => {
    if (!_balance) return [undefined, ''];
    if (_balance instanceof BigNumber) return [_balance, ''];
    return [_balance.total, (
      <>
        Farm Balance: {token ? displayTokenAmount(_balance.internal, token) : displayBN(_balance.internal)}<br />
        Circulating Balance: {token ? displayTokenAmount(_balance.external, token) : displayBN(_balance.external)}<br />
        <Divider color="secondary" sx={{ my: 1 }} />
        The Beanstalk UI first spends the balance that is most gas-efficient based on the specified amount.
      </>
    )];
  }, [_balance, token]);

  // Automatically disable the input if
  // the form it's contained within is 
  // submitting, or if a zero balance is provided.
  // Otherwise fall back to the disabled prop.
  const isInputDisabled = (
    disabled
    || (balance && balance.eq(0))
    || form.isSubmitting
  );

  const clamp = useCallback((amount: BigNumber | null) => {
    const max = _max === 'use-balance' ? balance : _max; // fallback to balance
    console.debug(`[TokenInputField@${field.name}] clamp: `, {
      amount: amount?.toString(),
      max: max?.toString(),
      balance: balance?.toString(),
    });
    if (!amount) return undefined; // if no amount, exit
    if (min?.gt(amount)) return min; // clamp @ min
    if (!allowNegative && amount?.lt(ZERO_BN)) return ZERO_BN; // clamp negative 
    if (max?.lt(amount)) return max; // clamp @ max
    return amount; // no max; always return amount
  }, [_max, balance, field.name, min, allowNegative]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    /// If e.target.value is non-empty string, parse it into a BigNumber.
    /// Using BigNumber here is necessary to prevent roundoff errors
    /// caused by parseFloat.
    ///
    /// Example: consider a case where the max button is pressed
    /// when the user has `balance = 1.042162935734305698 ETH`.
    /// this number trims at 16 decimals to "1.0421629357343056".
    /// when re-initializing this as a BigNumber the numbers will fail comparison,
    /// causing an infinite loop.
    ///
    /// FIXME: throws an error if e.target.value === '.'
    const newValue = e.target.value ? new BigNumber(e.target.value) : null;

    /// Always update the display amount right away.
    setDisplayAmount(newValue?.toString() || '');

    /// Only push a new value to form state if the numeric
    /// value is different. For example, if the displayValue
    /// goes from '1.0' -> '1.00', don't trigger an update.
    if (newValue === null || !newValue.eq(field.value)) {
      const clampedValue = clamp(newValue);
      form.setFieldValue(field.name, clampedValue);
      onChange?.(clampedValue); // bubble up if necessary
    }
  }, [form, field.name, field.value, onChange, clamp]);

  // 
  const handleMax = useCallback(() => {
    console.debug('[TokenInputField] handleMax');
    if (balance) {
      const clampedValue = clamp(balance);
      console.debug('[TokenInputField] handleMax: balance exists', {
        balance,
        clampedValue,
      });
      form.setFieldValue(field.name, clampedValue);
      onChange?.(clampedValue);  // bubble up if necessary
    }
  }, [form, field.name,balance, onChange, clamp]);

  // Ignore scroll events on the input. Prevents
  // accidentally scrolling up/down the number input.
  const handleWheel = useCallback((e: any) => {
    // @ts-ignore
    e.target.blur();
  }, []);

  // PROBLEM: BigNumber('0') == BigNumber('0.0').
  // --------------------------------------------
  // If a user were to try to type in a small number (0.001 ETH for example),
  // using BigNumber to track the state of the input wouldn't work; ex. when
  // I try to go from 0 to 0.0 the input value stays as just 0.
  //
  // SOLUTION:
  // Allow TokenInputField to maintain `displayAmount`, an internal `string` representation of `field.value`.
  // - On input change, store the input value (as `string`) in displayAmount.
  // - In the below effect, check for edge cases:
  //    a. If `field.value === undefined` (i.e. the value has been cleared), reset the input.
  //    b. If `field.value.toString() !== displayAmount` (i.e. a new value was provided), update `displayAmount`.
  //
  // Called after:
  // (1) user clicks max (via setFieldValue)
  // (2) handleChange
  // (3) external modification to field.value
  useEffect(() => {
    if (!field.value) {
      if (displayAmount !== '') {
        console.debug('[TokenInputField] clearing', {
          name: field.name,
        });
        setDisplayAmount('');
      }
    }
    else if (field.value.toString() !== displayAmount) {
      console.debug(`[TokenInputField/${field.name}] field.value or displayAmount changed:`, {
        name: field.name,
        value: field.value,
        valueString: field.value?.toString(),
        displayAmount: displayAmount,
      });
      setDisplayAmount(field.value.toString()); 
    }
  }, [field.name, field.value, displayAmount]);

  return (
    <FieldWrapper label={label}>
      {/* Input */}
      <TextField
        type="text"
        color="primary"
        placeholder={placeholder || '0'}
        disabled={isInputDisabled}
        fullWidth // default to fullWidth
        {...textFieldProps}
        // Override the following props.
        onWheel={handleWheel}
        value={displayAmount || ''}
        onChange={handleChange}
        InputProps={inputProps}
        onKeyDown={!allowNegative ? preventNegativeInput : undefined}
        sx={{
          borderRadius: 1,
          '& .MuiOutlinedInput-root': {
            background: '#fff',
          },
          ...sx
        }}
      />
      {/* Bottom Adornment */}
      {(balance && !hideBalance || quote) && (
        <Row gap={0.5} px={0.5} pt={0.75}>
          {/* Leaving the Stack rendered regardless of whether `quote` is defined
            * ensures that the Balance section gets flexed to the right side of
            * the input. */}
          <Row sx={{ flex: 1 }} spacing={1}>
            <Typography variant="bodySmall">
              {quote}
            </Typography>
          </Row>
          {(balance && !hideBalance) && (
            <>
              <Tooltip title={balanceTooltip}>
                <Typography variant="body1">
                  {balanceLabel}: {(
                    balance
                      ? token
                        // If `token` is provided, use its requested decimals
                        ? `${displayFullBN(balance, token.displayDecimals)}`
                        // Otherwise... *shrug*
                        // : balance.toString()
                        : `${displayFullBN(balance, 2)}`
                      : '0'
                  )}
                </Typography>
              </Tooltip>
              <Typography
                variant="body1"
                onClick={isInputDisabled ? undefined : handleMax}
                color={isInputDisabled ? 'text.secondary' : 'primary'}
                sx={{ cursor: isInputDisabled ? 'inherit' : 'pointer' }}
              >
                (Max)
              </Typography>
            </>
          )}
        </Row>
      )}
    </FieldWrapper>
  );
};

const TokenInputField: FC<TokenInputProps> = ({ name, ...props }) => (
  <Field name={name}>
    {(fieldProps: FieldProps) => (
      <TokenInput
        {...fieldProps}
        {...props}
      />
    )}
  </Field>
);

export default TokenInputField;
