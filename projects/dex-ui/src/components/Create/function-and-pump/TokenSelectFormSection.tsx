import React from "react";
import { useFormContext } from "react-hook-form";
import { Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";
import { CreateWellProps } from "../CreateWellProvider";
import { DropdownField } from "src/components/Common/Dropdown";
import styled from "styled-components";
import { AddressInputField } from "src/components/Common/Form";
import { ethers } from "ethers";

const allowedTokenTypes = ["ERC20", "ERC1155"];

type FormValues = CreateWellProps["wellFunctionAndPump"];

export const TokenSelectFormSection = () => {
  const { control, register } = useFormContext<FormValues>();

  //   const values = useWatch({ control: form.control, name: "token1.type" });

  return (
    <Flex $gap={2} $fullWidth>
      <Text $variant="h3">Tokens</Text>
      <Flex $direction="row" $gap={4} $fullWidth>
        <Flex $width="50%">
          <Text $color="text.secondary" $variant="xs" $mb={1}>
            Token 1 Type
          </Text>
          <DropdownField control={control} name="token1.type" align="center">
            {allowedTokenTypes.map((_type) => (
              <DropdownField.Option value={_type} key={`dropdown-${_type}`}>
                <Text $align="center">{_type}</Text>
              </DropdownField.Option>
            ))}
          </DropdownField>
        </Flex>
        <Flex $width="50%">
          <Text $color="text.secondary" $variant="xs" $mb={1}>
            Token 2 Type
          </Text>
          <DropdownField control={control} name="token2.type" align="center">
            {allowedTokenTypes.map((_type) => (
              <DropdownField.Option value={_type} key={`dropdown-${_type}`}>
                <Text $align="center">{_type}</Text>
              </DropdownField.Option>
            ))}
          </DropdownField>
        </Flex>
      </Flex>
      <Flex $direction="row" $gap={4} $fullWidth>
        <TokenContainer>
          <Text $color="text.secondary" $variant="xs" $mb={1}>
            Specify token
          </Text>
          <AddressInputField
            {...register("token1.address", {
                validate: (value) => ethers.utils.isAddress(value) || "Invalid address"
            })}
            placeholder="Search for token or input an address"
            isSearch
          />
        </TokenContainer>
        <TokenContainer>
          <Text $color="text.secondary" $variant="xs" $mb={1}>
            Specify token
          </Text>
          <AddressInputField
            {...register("token2.address", {
                validate: (value) => ethers.utils.isAddress(value) || "Invalid address"
            })}
            placeholder="Search for token or input an address"
            // isSearch
          />
        </TokenContainer>
      </Flex>
    </Flex>
  );
};

const TokenContainer = styled(Flex)`
  width: 50%;
  max-width: 50%;
`;
