import React from 'react';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { Field, FieldProps, Formik } from 'formik';
import { Card } from '@mui/material';
import BigNumber from 'bignumber.js';
import TokenInputField from './TokenInputField';

export default {
  component: TokenInputField,
  args: {
    balance: new BigNumber(100),
    // token: BEAN[1],
    InputLabelProps: {
      disableAnimation: true,
    }
  }
} as ComponentMeta<typeof TokenInputField>;

const Template: ComponentStory<typeof TokenInputField> = (args: any) => {
  const a = (
    <Card sx={{ maxWidth: 300, p: 2 }}>
      <Formik initialValues={{ test: undefined }} onSubmit={() => {}}>
        <Field name="test">
          {(fieldProps: FieldProps) => (
            <TokenInputField
              {...fieldProps}
              {...args}
            />
          )}
        </Field>
      </Formik>
    </Card>
  );
  
  return a;
};

const Base = Template.bind({});
Base.args = {
  label: 'Test',
};

export { Base };
