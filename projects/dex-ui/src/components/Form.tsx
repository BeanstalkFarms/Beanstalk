import React, { InputHTMLAttributes, forwardRef } from "react";
import { theme } from "src/utils/ui/theme";
import styled from "styled-components";
import { LinksButtonText, Text } from "src/components/Typography";
import { Flex } from "./Layout";
import { SearchIcon } from "./Icons";
import { Control, Controller, FieldValues, Path } from "react-hook-form";
import { ToggleSwitch } from "./ToggleSwitch";

type IconType = "search"; // add more here later

export type TextInputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  startIcon?: IconType;
};

const iconMapping = {
  search: <SearchIcon />
};

const StartIcon = React.memo((props: { startIcon: IconType | undefined }) => {
  if (!props.startIcon) return null;
  return iconMapping[props.startIcon];
});

export const TextInputField = forwardRef<HTMLInputElement, TextInputFieldProps>(
  ({ error, startIcon, ...props }, ref) => {
    return (
      <Flex>
        <Wrapper>
          <StartIcon startIcon={startIcon} />
          <StyledTextInputField {...props} onChange={props.onChange} ref={ref} type="text" />
        </Wrapper>
        {error ? (
          <Text $color="error" $variant="xs" $mt={0.5}>
            {error}
          </Text>
        ) : null}
      </Flex>
    );
  }
);

const Wrapper = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${theme.spacing(0.5)};
  box-sizing: border-box;
  align-items: center;
  border: 0.5px solid ${theme.colors.black};
  background: ${theme.colors.white};
  padding: ${theme.spacing(1, 1.5)};

  input {
    ${LinksButtonText}
    font-weight: 400;
    outline: none;
    border: none;
    width: 100%;
    box-sizing: border-box;
  }

  svg {
    margin-bottom: ${theme.spacing(0.25)};
  }
`;

const StyledTextInputField = styled.input`
  color: ${theme.colors.black};

  ::placeholder {
    color: ${theme.colors.gray};
  }
`;

type SwitchFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
};

export const SwitchField = <T extends FieldValues>({ control, name }: SwitchFieldProps<T>) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const value = typeof field.value === "boolean" ? field.value : false;
        return <ToggleSwitch checked={value} toggle={() => field.onChange(!value)} />;
      }}
    />
  );
};