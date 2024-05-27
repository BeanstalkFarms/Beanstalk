import React from "react";
import { useFormContext } from "react-hook-form";
import { Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";
import { CreateWellProps } from "../CreateWellProvider";
import { DropdownField } from "src/components/Common/Dropdown";
import styled from "styled-components";

const allowedTokenTypes = ["ERC20", "ERC1155"];

type FormValues = CreateWellProps["wellFunctionAndPump"];

export const TokenSelectFormSection = () => {
  const form = useFormContext<FormValues>();

  //   const values = useWatch({ control: form.control, name: "token1.type" });

  return (
    <Flex $gap={2} $fullWidth>
      <Text $variant="h3">Tokens</Text>
      <Flex $direction="row" $gap={4} $fullWidth>
        <TokenContainer $width="50%">
          <Text $color="text.secondary" $variant="xs" $mb={1}>
            Token 1 Type
          </Text>
          <DropdownField control={form.control} name="token1.type" align="center">
            {allowedTokenTypes.map((_type) => (
              <DropdownField.Option value={_type} key={`dropdown-${_type}`}>
                <Text $align="center">{_type}</Text>
              </DropdownField.Option>
            ))}
          </DropdownField>
        </TokenContainer>
        <TokenContainer $width="50%">
          <Text $color="text.secondary" $variant="xs" $mb={1}>
            Token 2 Type
          </Text>
          <DropdownField control={form.control} name="token2.type" align="center">
            {allowedTokenTypes.map((_type) => (
              <DropdownField.Option value={_type} key={`dropdown-${_type}`}>
                <Text $align="center">{_type}</Text>
              </DropdownField.Option>
            ))}
          </DropdownField>
        </TokenContainer>
      </Flex>
    </Flex>
  );
};

const TokenContainer = styled(Flex)`
  width: 50%;
  max-width: 50%;
`;
