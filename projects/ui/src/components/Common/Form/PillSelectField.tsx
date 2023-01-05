import React, { ReactNode } from 'react';
import { Stack, Typography, TypographyProps } from '@mui/material';
import { Field, FieldProps } from 'formik';
import useToggle from '~/hooks/display/useToggle';
import DescriptionButton from '../DescriptionButton';
import PillDialogField from './PillDialogField';
import { FC } from '~/types';

export type PillSelectFieldProps = {
  /** Options */
  options: ({
    title: string;
    description: string;
    icon: string | ReactNode;
    pill: string | ReactNode;
    value: any;
    titleProps?: TypographyProps;
  })[]
  /** Field name */
  name: string;
  /** Field label */
  label: string;
  /** Field label props */
  labelProps?: Omit<TypographyProps, 'color'>
  /** Tooltip */
  tooltip?: string,
  /** */
  onChange?: (v: any) => void;
};

const PillSelectField : FC<PillSelectFieldProps> = ({
  options,
  name,
  label,
  labelProps,
  tooltip,
  onChange,
}) => {
  const [isOpen, show, hide] = useToggle();
  return (
    <Field name={name}>
      {(fieldProps: FieldProps<any>) => {
        const pill = options.find((x) => x.value === fieldProps.field.value)?.pill || <Typography variant="body1">Select {label}</Typography>; // FIXME: inefficient
        const set = (v: any) => () => {
          fieldProps.form.setFieldValue(name, v);
          onChange?.(v);
          hide();
        };
        return (
          <PillDialogField
            isOpen={isOpen}
            show={show}
            hide={hide}
            label={label}
            tooltip={tooltip}
            pill={pill}
            pl={0.5}
            labelProps={labelProps}
          >
            {/* Dialog contents */}
            <Stack gap={1}>
              {options.map((option, index) => (
                <DescriptionButton
                  key={index}
                  {...option}
                  onClick={set(option.value)}
                  fullWidth
                  disableRipple
                />
              ))}
            </Stack>
          </PillDialogField>
        );
      }}
    </Field>
  );
};

export default PillSelectField;
