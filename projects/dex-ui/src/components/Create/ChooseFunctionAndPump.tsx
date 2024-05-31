import React, { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { ethers } from "ethers";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";

import { getIsValidEthereumAddress } from "src/utils/addresses";

import { theme } from "src/utils/ui/theme";
import { Divider, Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";
import { CreateWellButtonRow } from "./shared/CreateWellButtonRow";
import { TextInputField } from "src/components/Form";
import { XIcon } from "src/components/Icons";

import { CreateWellStepProps, useCreateWell } from "./CreateWellProvider";
import { CreateWellFormProgress } from "./shared/CreateWellFormProgress";
import { ComponentInputWithCustom } from "./shared/ComponentInputWithCustom";
import { useERC20TokenWithAddress } from "src/tokens/useERC20Token";
import { ERC20Token } from "@beanstalk/sdk";

const additionalOptions = [
  {
    value: "none",
    label: "None",
    subLabel: "No Pump"
  }
];

type TokenFormValues = {
  token1: string;
  token2: string;
};

type OmitWellTokens = Omit<CreateWellStepProps["step2"], "wellTokens">;

export type FunctionTokenPumpFormValues = OmitWellTokens & TokenFormValues;

const aave = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9".toLowerCase(); // AAVE
const bean = "0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab".toLowerCase(); // BEAN

const ChooseFunctionAndPumpForm = () => {
  const { wellTokens, wellFunction, pump, setStep2 } = useCreateWell();
  const [token1, setToken1] = useState<ERC20Token | undefined>(undefined);
  const [token2, setToken2] = useState<ERC20Token | undefined>(undefined);

  const methods = useForm<FunctionTokenPumpFormValues>({
    defaultValues: {
      wellFunction: wellFunction || "",
      token1: wellTokens?.token1?.address || "",
      token2: wellTokens?.token2?.address || "",
      pump: pump || ""
    }
  });

  const handleSave = useCallback(() => {
    const values = methods.getValues();
    setStep2({
      ...values,
      token1: token1,
      token2: token2
    });
  }, [token1, token2, methods, setStep2]);

  const handleSubmit = useCallback(
    (values: FunctionTokenPumpFormValues) => {
      for (const key in values) {
        const value = values[key as keyof typeof values];
        if (!value || !getIsValidEthereumAddress(value)) return;
      }
      if (!token1 || !token2) return;

      const payload = {
        ...values,
        token1: token1,
        token2: token2
      };

      setStep2({ ...payload, goNext: true });
    },
    [setStep2, token1, token2]
  );

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmit)} style={{ width: "100%" }}>
        <Flex $direction="row" $gap={6}>
          <CreateWellFormProgress />
          <Flex $fullWidth $gap={4}>
            {/*
             * Well Function Form Section
             */}
            <SectionWrapper $direction="row" $fullWidth $justifyContent="space-between" $gap={2}>
              <Flex $gap={2} className="description">
                <Text $variant="h3">Well Functions</Text>
                <Text $variant="xs" $color="text.secondary">
                  Choose a Well Function to determine how the tokens in the Well get priced.
                </Text>
              </Flex>
              <Flex className="form-section" $gap={2} $fullWidth>
                <ComponentInputWithCustom
                  toggleMessage="Use a custom Well Implementation instead"
                  path="wellFunction"
                  componentType="wellFunctions"
                  emptyValue=""
                />
              </Flex>
            </SectionWrapper>
            <Divider />
            {/*
             * Token Select Section
             */}
            <Flex $gap={2} $fullWidth>
              <Text $variant="h3">Tokens</Text>
              <Flex $direction="row" $gap={4} $fullWidth>
                <HalfWidthFlex>
                  <Text $color="text.secondary" $variant="xs" $mb={1}>
                    Specify token
                  </Text>
                  <TokenAddressInputWithSearch path={"token1"} setToken={setToken1} />
                </HalfWidthFlex>
                <HalfWidthFlex>
                  <Text $color="text.secondary" $variant="xs" $mb={1}>
                    Specify token
                  </Text>
                  <TokenAddressInputWithSearch path={"token2"} setToken={setToken2} />
                </HalfWidthFlex>
              </Flex>
            </Flex>
            <Divider />
            {/*
             * Pump Select Section
             */}
            <SectionWrapper $direction="row" $justifyContent="space-between" $fullWidth $gap={2}>
              <Flex $gap={2} className="description" $justifyContent="flex-start">
                <Text $variant="h3">Pumps</Text>
                <Text $variant="xs">Choose Pump(s) to set up a price feed from your Well.</Text>
              </Flex>
              <Flex className="form-section" $gap={2} $fullWidth>
                <ComponentInputWithCustom
                  componentType="pumps"
                  path="pump"
                  toggleMessage="Use a custom Pump"
                  emptyValue=""
                  additional={additionalOptions}
                />
              </Flex>
            </SectionWrapper>
            {/*
             * Actions
             */}
            <CreateWellButtonRow onGoBack={handleSave} disabled={!token1 || !token2} />
          </Flex>
        </Flex>
      </form>
    </FormProvider>
  );
};

export const ChooseFunctionAndPump = () => {
  return (
    <Flex $gap={3} $fullWidth>
      <div>
        <Text $variant="h2">Create a Well - Choose a Well Function and Pump</Text>
        <Subtitle>Select the components to use in your Well.</Subtitle>
      </div>
      <ChooseFunctionAndPumpForm />
    </Flex>
  );
};

// ---------- STYLES & COMPONENTS ----------

const TokenAddressInputWithSearch = ({
  path,
  setToken
}: {
  path: "token1" | "token2";
  setToken: React.Dispatch<React.SetStateAction<ERC20Token | undefined>>;
}) => {
  const {
    register,
    control,
    setValue,
    setError,
    formState: {
      errors: { [path]: formError }
    }
  } = useFormContext<FunctionTokenPumpFormValues>();
  const _value = useWatch({ control, name: path });
  const value = typeof _value === "string" ? _value : "";

  const { data: token, error, isLoading } = useERC20TokenWithAddress(value);

  useEffect(() => {
    if (error?.message) {
      setError(path, { message: error.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error?.message]);

  const tokenAndFormValueMatch = Boolean(token && token.address === value.toLowerCase());

  useEffect(() => {
    if (token && tokenAndFormValueMatch) {
      setToken(token);
    } else {
      setToken(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tokenAndFormValueMatch]);

  return (
    <>
      {!token || isLoading ? (
        <TextInputField
          {...register(path, {
            validate: (value, formValues) => {
              if (!getIsValidEthereumAddress(value)) return "Invalid address";
              const otherTokenKey = path === "token1" ? "token2" : "token1";
              const otherTokenAddress = formValues[otherTokenKey];

              if (
                getIsValidEthereumAddress(otherTokenAddress) &&
                value.toLowerCase() === otherTokenAddress.toLowerCase()
              ) {
                return "Unique tokens required";
              }

              return true;
            }
          })}
          placeholder="Search for token or input an address"
          startIcon="search"
          error={error?.message}
        />
      ) : (
        <Flex>
          <FoundTokenInfo>
            {token?.logo && (
              <ImgContainer width={16} height={16}>
                {<img src={token.logo} alt={value} />}
              </ImgContainer>
            )}
            <Text $variant="button-link">{token.symbol || ""}</Text>{" "}
            <Flex onClick={() => setValue(path, "")}>
              <XIcon width={10} height={10} />
            </Flex>
          </FoundTokenInfo>
          {formError?.message && (
            <Text $color="error" $variant="xs" $mt={0.5}>
              {formError?.message}
            </Text>
          )}
        </Flex>
      )}
    </>
  );
};

const FoundTokenInfo = styled.div`
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

const SectionWrapper = styled(Flex)`
  .description {
    max-width: 180px;
  }

  .form-section {
    max-width: 713px;
    width: 100%;
  }
`;

const HalfWidthFlex = styled(Flex)`
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

const Subtitle = styled(Text)`
  margin-top: ${theme.spacing(0.5)};
  color: ${theme.colors.stone};
`;
