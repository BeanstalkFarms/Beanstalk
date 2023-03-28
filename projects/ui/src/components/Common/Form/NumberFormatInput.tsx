import React from 'react';
import NumberFormat, { InputAttributes } from 'react-number-format';

interface CustomProps {
  onChange: (event: { target: { name: string; value: string } }) => void;
  name: string;
}

export default React.forwardRef<
  NumberFormat<InputAttributes>,
  CustomProps
>((props, ref) => {
  const { onChange, ...other } = props;
  return (
    <NumberFormat
      {...other}
      getInputRef={ref}
      onValueChange={(values) => {
        onChange({
          target: {
            name: props.name,
            value: values.value,
          },
        });
      }}
      thousandSeparator
      isNumericString
      // prefix="$"
    />
  );
});
