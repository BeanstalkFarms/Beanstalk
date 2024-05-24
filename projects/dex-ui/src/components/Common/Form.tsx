import React, { InputHTMLAttributes, forwardRef } from "react";
import { theme } from "src/utils/ui/theme";
import styled from "styled-components";
import { LinksButtonText, Text } from "src/components/Typography";
import { Flex } from "../Layout";

export type AddressInputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
};

export const AddressInputField = forwardRef<HTMLInputElement, AddressInputFieldProps>(({ error, ...props }, ref) => {
  return (
    <Flex>
      <StyledAddressInputField {...props} onChange={props.onChange} ref={ref} type="text" />
      {error && (
        <Text $color="error" $variant="xs" $mt={0.5}>
          {error}
        </Text>
      )}
    </Flex>
  );
});

const StyledAddressInputField = styled.input`
  border: 0.5px solid ${theme.colors.black};
  background: ${theme.colors.white};
  ${LinksButtonText};
  color: ${theme.colors.black};
  padding: ${theme.spacing(1, 1.5)};
  box-sizing: border-box;

  ::placeholder {
    color: ${theme.colors.gray};
  }
`;
