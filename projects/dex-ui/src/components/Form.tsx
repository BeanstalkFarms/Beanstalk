import React, { InputHTMLAttributes, forwardRef } from "react";
import { theme } from "src/utils/ui/theme";
import styled from "styled-components";
import { LinksButtonText, Text } from "src/components/Typography";
import { Flex } from "./Layout";
import { SearchIcon } from "./Icons";

export type TextInputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  isSearch?: boolean;
};

export const TextInputField = forwardRef<HTMLInputElement, TextInputFieldProps>(
  ({ error, isSearch, ...props }, ref) => {
    return (
      <Flex>
        <Wrapper>
          {isSearch ? <SearchIcon /> : null}
          <StyledTextInputField {...props} onChange={props.onChange} ref={ref} type="text" />
        </Wrapper>
        {error && (
          <Text $color="error" $variant="xs" $mt={0.5}>
            {error}
          </Text>
        )}
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
