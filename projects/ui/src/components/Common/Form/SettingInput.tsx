import React from 'react';
import { Field, FieldProps } from 'formik';
import { TextField, Typography } from '@mui/material';
import { Box } from '@mui/system';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

const SettingInput : FC<{
  name: string;
  label: string;
  endAdornment?: React.ReactNode;
}> = ({
  name,
  label,
  endAdornment,
}) => (
  <Field name={name}>
    {(fieldProps: FieldProps) => (
      <Row gap={5} justifyContent="space-between">
        <Typography variant="body1">{label}</Typography>
        <Box>
          <TextField
            size="small"
            variant="standard"
            type="number"
            sx={{
                minWidth: 'none',
                width: 50,
              }}
            InputProps={{
                endAdornment,
                sx: {
                  fontSize: 16,
                }
              }}
            {...fieldProps.field}
            />
        </Box>
      </Row>
      )}
  </Field>
  );

export default SettingInput;
