import React from 'react';
import { Field, FieldProps } from 'formik';
import { Switch, Typography } from '@mui/material';
import { Box } from '@mui/system';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

const SettingSwitch: FC<{
  name: string;
  label: string;
}> = ({ name, label }) => (
  <Field name={name} type="checkbox">
    {(fieldProps: FieldProps) => (
      <Row gap={5} justifyContent="space-between">
        <Typography variant="body1">{label}</Typography>
        <Box>
          <Switch
            {...fieldProps.field}
            checked={fieldProps.field.value === true}
            onChange={(event, checked) => {
              fieldProps.form.setFieldValue(name, checked);
            }}
          />
        </Box>
      </Row>
    )}
  </Field>
);

export default SettingSwitch;
