import React from 'react';
import { Field, FieldProps } from 'formik';
import { Button, CardProps, Grid, GridProps, Stack, StackProps, Typography } from '@mui/material';
import { BeanstalkPalette } from '../../App/muiTheme';

import { FC } from '~/types';

export type RadioCardFieldProps = {
  name: string;
  options: ({ 
    title: string;
    description: string;
    value: any;
  })[];
}

const RadioCardField: FC<(
  RadioCardFieldProps & 
  StackProps & 
  CardProps & 
  GridProps
)> = ({
  // Form field
  name,
  // Option config
  options,
  // Styling
  direction,
  xs = 12,
  md = 6,
  spacing = 1,
}) => (
  <Field name={name}>
    {(fieldProps: FieldProps) => (
      <Grid container direction={direction} spacing={spacing}>
        {options.map((opt, index) => {
            const selected = fieldProps.field.value === opt.value;
            const color    = selected ? BeanstalkPalette.logoGreen : BeanstalkPalette.lightGrey;
            return (
              <Grid key={index} item xs={xs} md={md}>
                <Button
                  onClick={() => {
                    fieldProps.form.setFieldValue(name, opt.value);
                  }}
                  fullWidth
                  // variant={selected ? 'contained' : 'outlined'}
                  variant="outlined"
                  color="primary"
                  sx={{
                    textAlign: 'left',
                    px: 1,
                    py: 1,
                    // backgroundColor: selected ? 'primary.light' : 'inherit',
                    borderColor: selected ? `${BeanstalkPalette.logoGreen} !important` : 'gray',
                    outlineColor: 'primary',
                    outlineWidth: selected ? 0.5 : 0,
                    outlineStyle: 'solid',
                    '&:hover': {
                      backgroundColor: selected ? 'primary.light' : 'inherit',
                      borderColor: selected ? 'gray' : 'inherit',
                    }
                  }}
                >
                  <Stack justifyContent="center" alignItems="center" height="100%">
                    <Typography
                      sx={{
                        textAlign: 'center',
                        fontsize: '18px',
                        // fontWeight: 'bold',
                        color
                      }}
                    >
                      {opt.title}
                    </Typography>
                    <Typography
                      sx={{
                        textAlign: 'center',
                        fontSize: '13px',
                        color
                      }}
                    >
                      {opt.description}
                    </Typography>
                  </Stack>
                </Button>
              </Grid>
            );
          })}
      </Grid>
      )}
  </Field>
  );

export default RadioCardField;
