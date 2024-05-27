import React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";
import { CreateWellProps } from "../CreateWellProvider";
import styled from "styled-components";
import { AddressInputField } from "src/components/Common/Form";
import { ethers } from "ethers";

import { theme } from "src/utils/ui/theme";
import { XIcon } from "src/components/Icons";
import { useTokenMetadata } from "src/utils/token/useTokenMetadata";

type FormValues = CreateWellProps["wellFunctionAndPump"];

const TokenAddressInputWithSearch = ({ path }: { path: "token1" | "token2" }) => {
  const { register, control, setValue } = useFormContext<FormValues>();
  const _value = useWatch({ control, name: path });
  const value = typeof _value === "string" ? _value : "";

  const metadata = useTokenMetadata(value);

  const logo = metadata?.logo || "";
  const symbol = metadata?.symbol || "";

  return (
    <>
      {!symbol && !logo ? (
        <AddressInputField
          {...register(path, {
            validate: (value) => ethers.utils.isAddress(value) || "Invalid address"
          })}
          placeholder="Search for token or input an address"
          isSearch
        />
      ) : (
        <FieldDataWrapper>
          {logo && (
            <ImgContainer width={16} height={16}>
              {<img src={logo} alt={value} />}
            </ImgContainer>
          )}
          <Text $variant="button-link">{symbol}</Text>{" "}
          <Flex onClick={() => setValue(path, "")}>
            <XIcon width={10} height={10} />
          </Flex>
        </FieldDataWrapper>
      )}
    </>
  );
};

const FieldDataWrapper = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${theme.spacing(1)};
  box-sizing: border-box;
  align-items: center;
  border: 1px solid ${theme.colors.black};
  background: ${theme.colors.primaryLight};
  padding: ${theme.spacing(1, 1.5)};

  svg {
    margin-bottom: 2px;
    cursor: pointer;
  }
`;

export const TokenSelectFormSection = () => {
  return (
    <Flex $gap={2} $fullWidth>
      <Text $variant="h3">Tokens</Text>

      <Flex $direction="row" $gap={4} $fullWidth>
        <TokenContainer>
          <Text $color="text.secondary" $variant="xs" $mb={1}>
            Specify token
          </Text>
          <TokenAddressInputWithSearch path={"token1"} />
        </TokenContainer>
        <TokenContainer>
          <Text $color="text.secondary" $variant="xs" $mb={1}>
            Specify token
          </Text>
          <TokenAddressInputWithSearch path={"token2"} />
        </TokenContainer>
      </Flex>
    </Flex>
  );
};

const TokenContainer = styled(Flex)`
  width: 50%;
  max-width: 50%;
`;

const ImgContainer = styled.div<{
  width: number;
  height: number;
}>`
  display: flex;
  justify-content: center;
  align-items: center;

  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  img {
    width: ${(props) => props.width}px;
    height: ${(props) => props.height}px;
  }
`;
