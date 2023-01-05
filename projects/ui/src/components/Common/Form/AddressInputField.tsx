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
  useMediaQuery
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
import { trimAddress } from '../../../util';
import Row from '~/components/Common/Row';
import { FC } from '~/types';

export type AddressInputFieldProps = (
  Partial<TextFieldProps>
  & { name: string }
);

export const ETHEREUM_ADDRESS_CHARS = /([0][x]?[a-fA-F0-9]{0,42})$/;

const validateAddress = (account?: string) => (value: string) => {
  let error;
  if (!value) {
    error = 'Enter an address';
  } else if (account && value?.toLowerCase() === account.toLowerCase()) {
    error = 'Cannot Transfer to yourself';
  // } else if (!ETHEREUM_ADDRESS_CHARS.test(value)) {
  } else if (!ethers.utils.isAddress(value)) {
    error = 'Enter a valid address';
  }
  return error;
};

const AddressInputFieldInner : FC<FieldProps & AddressInputFieldProps> = ({
  name,
  disabled,
  /// Formik
  field,
  meta,
  form,
  ...props
}) => {
  const chainId = useChainId();
  const isValid = field.value?.length === 42 && !meta.error;
  const onChange = useCallback((e: any) => {
    // Allow field to change if the value has been removed, or if
    // a valid address character has been input.
    if (!e.target.value || ETHEREUM_ADDRESS_CHARS.test(e.target.value)) {
      field.onChange(e);
    }
  }, [field]);

  //
  const InputProps = useMemo(() => ({
    startAdornment: meta.value ? (
      <InputAdornment position="start">
        <CloseIcon color="warning" /> 
      </InputAdornment>
    ) : null
  }), [meta.value]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (isValid) {
    return (
      <OutputField sx={{ height: 67.5 /* lock to same height as input */ }}>
        <Row spacing={1}>
          <CheckIcon sx={{ height: 20, width: 20, fontSize: '100%' }} color="primary" />
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
    );
  }
  return (
    <Stack gap={0.5}>
      <TextField
        fullWidth
        type="text"
        placeholder="0x0000"
        disabled={isValid || disabled}
        InputProps={InputProps}
        {...props}
        name={field.name}
        value={field.value}
        onBlur={field.onBlur}
        onChange={onChange}
      />
      {meta.touched && (
        <Box sx={{ px: 0.5 }}>
          <Typography fontSize="bodySmall" textAlign="right" color="text.secondary">
            {meta.error}
          </Typography>
        </Box>
      )}
    </Stack>
  );
};

const AddressInputField : FC<AddressInputFieldProps> = ({
  name,
  ...props
}) => {
  const account = useAccount();
  const validate = useMemo(() => validateAddress(account), [account]);
  return (
    <Field
      name={name}
      validate={validate}
      validateOnBlur
    >
      {(fieldProps: FieldProps) => (
        <AddressInputFieldInner
          name={name}
          {...props}
          {...fieldProps}
        />
      )}
    </Field>
  );
};

export default AddressInputField;
