import React, { useCallback, useMemo } from 'react';
import {
  Box,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  TextFieldProps,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { Field, FieldProps } from 'formik';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useTheme } from '@mui/material/styles';
import { ethers } from 'ethers';
import useChainId from '~/hooks/chain/useChainId';
import useAccount from '~/hooks/ledger/useAccount';
import { CHAIN_INFO } from '~/constants';
import OutputField from './OutputField';
import BorderEffect from './BorderEffect';
import { trimAddress } from '../../../util';
import Row from '~/components/Common/Row';
import { FC } from '~/types';

export type AddressInputFieldProps = Partial<TextFieldProps> & {
  name: string;
  allowTransferToSelf?: boolean;
  newLabel?: string;
};

export const ETHEREUM_ADDRESS_CHARS = /([0][x]?[a-fA-F0-9]{0,42})$/;

export const validateAddress =
  (account?: string, allowTransferToSelf?: boolean) => (value: string) => {
    let error;
    if (!value) {
      error = 'Enter an address';
    } else if (
      account &&
      value?.toLowerCase() === account.toLowerCase() &&
      !allowTransferToSelf
    ) {
      error = 'Cannot Transfer to yourself';
      // } else if (!ETHEREUM_ADDRESS_CHARS.test(value)) {
    } else if (!ethers.utils.isAddress(value)) {
      error = 'Enter a valid address';
    }
    return error;
  };

const textFieldStyles = {
  borderRadius: 1,
  '& label.Mui-focused': {
    color: 'transparent',
  },
  '& .MuiOutlinedInput-root': {
    background: 'transparent',
    pr: 0,
    pl: 0,
    '& fieldset': {
      border: 'none',
    },
    '&.Mui-focused fieldset': {
      border: 'none',
    },
    '&:hover fieldset': {
      border: 'none'
    },
    '& .MuiOutlinedInput-input': {
      pl: 0,
      py: 1.25,
    }
  }
} as const;

const AddressInputFieldInner : FC<FieldProps & AddressInputFieldProps> = ({
  name,
  disabled,
  allowTransferToSelf,
  newLabel,
  /// Formik
  field,
  meta,
  form,
  sx,
  ...props
}) => {
  const chainId = useChainId();
  const account = useAccount();
  const isValid = field.value?.length === 42 && !meta.error;
  const onChange = useCallback(
    (e: any) => {
      // Allow field to change if the value has been removed, or if
      // a valid address character has been input.
      if (!e.target.value || ETHEREUM_ADDRESS_CHARS.test(e.target.value)) {
        field.onChange(e);
      }
    },
    [field]
  );

  //
  const InputProps = useMemo(
    () => ({
      startAdornment: meta.value ? (
        <InputAdornment position="start">
          <CloseIcon color="warning" />
        </InputAdornment>
      ) : null,
    }),
    [meta.value]
  );

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (isValid) {
    return (
      <Box>
        {newLabel ? (
          <Typography
            sx={{
              fontSize: 'bodySmall',
              px: 0.5,
              mb: 0.25,
            }}
            component="span"
            display="inline-block"
          >
            {newLabel}
            {allowTransferToSelf && account ? (
              <Typography
                sx={{
                  px: 0.5,
                  cursor: 'pointer',
                }}
                display="inline-block"
                color="primary"
                onClick={() => form.setFieldValue(name, account)}
              >
                (Me)
              </Typography>
            ) : null}
          </Typography>
        ) : null}
        <OutputField sx={{ height: 67.5 /* lock to same height as input */ }}>
          <Row spacing={1}>
            <CheckIcon
              sx={{ height: 20, width: 20, fontSize: '100%' }}
              color="primary"
            />
            <Typography>
              <Tooltip title="View on Etherscan">
                <Link
                  underline="hover"
                  color="text.primary"
                  href={`${CHAIN_INFO[chainId].explorer}/address/${field.value}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {isMobile ? trimAddress(field.value) : field.value}
                </Link>
              </Tooltip>
            </Typography>
          </Row>
          <Box>
            <IconButton onClick={() => form.setFieldValue(name, '')}>
              <CloseIcon sx={{ height: 20, width: 20, fontSize: '100%' }} />
            </IconButton>
          </Box>
        </OutputField>
      </Box>
    );
  }
  return (
    <Stack gap={0.5}>
      {newLabel ? (
        <Typography
          sx={{
            fontSize: 'bodySmall',
            px: 0.5,
            mb: -0.25,
          }}
          component="span"
          display="inline-block"
        >
          {newLabel}
          {allowTransferToSelf && account ? (
            <Typography
              sx={{
                px: 0.5,
                cursor: 'pointer',
              }}
              display="inline-block"
              color="primary"
              onClick={() => form.setFieldValue(name, account)}
            >
              (Me)
            </Typography>) : null}
        </Typography>) : null}
      <BorderEffect disabled={isValid || disabled}>
        <Box width="100%" sx={{ px: 2 }}>
          <TextField
            fullWidth
            type="text"
            color="primary"
            placeholder="0x0000"
            disabled={isValid || disabled}
            InputProps={InputProps}
            {...props}
            name={field.name}
            value={field.value}
            onBlur={field.onBlur}
            onChange={onChange}
            sx={{ ...textFieldStyles, ...sx }}
          />
        </Box>
      </BorderEffect>
      {meta.touched && (
        <Box sx={{ px: 0.5 }}>
          <Typography
            fontSize="bodySmall"
            textAlign="right"
            color="text.secondary"
          >
            {meta.error}
          </Typography>
        </Box>
      )}
    </Stack>
  );
};

const AddressInputField: FC<AddressInputFieldProps> = ({
  name,
  allowTransferToSelf,
  ...props
}) => {
  const account = useAccount();
  const validate = useMemo(
    () => validateAddress(account, allowTransferToSelf),
    [account, allowTransferToSelf]
  );
  return (
    <Box>
      <Field name={name} validate={validate} validateOnBlur>
        {(fieldProps: FieldProps) => (
          <AddressInputFieldInner
            name={name}
            allowTransferToSelf={allowTransferToSelf}
            {...props}
            {...fieldProps}
          />
        )}
      </Field>
    </Box>
  );
};

export default AddressInputField;
