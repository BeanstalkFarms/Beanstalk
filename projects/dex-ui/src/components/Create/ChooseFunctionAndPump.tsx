import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";

import { getIsValidEthereumAddress } from "src/utils/addresses";

import { theme } from "src/utils/ui/theme";
import { Divider, Flex, FlexCard } from "src/components/Layout";
import { Text } from "src/components/Typography";
import { CreateWellButtonRow } from "./shared/CreateWellButtonRow";
import { StyledForm, TextInputField } from "src/components/Form";
import { XIcon } from "src/components/Icons";
import { CreateWellStepProps, useCreateWell } from "./CreateWellProvider";
import { CreateWellFormProgress } from "./shared/CreateWellFormProgress";
import { ComponentInputWithCustom } from "./shared/ComponentInputWithCustom";
import { USE_ERC20_TOKEN_ERRORS, useERC20TokenWithAddress } from "src/tokens/useERC20Token";
import { ERC20Token } from "@beanstalk/sdk";
import useSdk from "src/utils/sdk/useSdk";
import BoreWellUtils from "src/wells/boreWell";

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

const tokenFormKeys = ["token1", "token2"] as const;

const optionalKeys = ["wellFunctionData", "pumpData"] as const;

const ChooseFunctionAndPumpForm = () => {
  const { wellTokens, wellFunctionAddress, pumpAddress, setStep2, wellFunctionData, pumpData } =
    useCreateWell();
  const sdk = useSdk();

  const [token1, setToken1] = useState<ERC20Token | undefined>(undefined);
  const [token2, setToken2] = useState<ERC20Token | undefined>(undefined);

  const methods = useForm<FunctionTokenPumpFormValues>({
    defaultValues: {
      wellFunctionAddress: wellFunctionAddress || "",
      wellFunctionData: wellFunctionAddress || "",
      token1: wellTokens?.token1?.address || "",
      token2: wellTokens?.token2?.address || "",
      pumpAddress: pumpAddress || "",
      pumpData: pumpData || ""
    }
  });

  const handleSave = () => {
    const values = methods.getValues();

    setStep2({
      ...values,
      token1: token1,
      token2: token2
    });
  };

  const handleSubmit = async (values: FunctionTokenPumpFormValues) => {
    const valid = await methods.trigger();
    if (!valid || !token1 || !token2) return;
    if (token1.address === token2.address) return; // should never be true, but just in case

    const [tk1, tk2] = BoreWellUtils.prepareTokenOrderForBoreWell(sdk, [token1, token2]);
    setStep2({ ...values, token1: tk1, token2: tk2, goNext: true });
  };

  return (
    <FormProvider {...methods}>
      <StyledForm onSubmit={methods.handleSubmit(handleSubmit)} $width="100%">
        <FormInnerWrapper>
          <CreateWellFormProgress />
          <Flex $fullWidth $gap={4}>
            {/*
             * Well Function Form Section
             */}
            <SectionWrapper>
              <Flex $gap={2} className="description">
                <Text $variant="h3">Well Functions</Text>
                <Text $variant="xs" $color="text.secondary">
                  Choose a Well Function to determine how the tokens in the Well get priced.
                </Text>
              </Flex>
              <Flex className="form-section" $gap={2} $fullWidth>
                <ComponentInputWithCustom<FunctionTokenPumpFormValues>
                  toggleMessage="Use a custom Well Implementation instead"
                  path="wellFunctionAddress"
                  dataPath="wellFunctionData"
                  componentType="wellFunctions"
                  emptyValue=""
                  toggleOpen={!!wellFunctionData}
                />
              </Flex>
            </SectionWrapper>
            <Divider />
            {/*
             * Token Select Section
             */}
            <Flex $gap={2} $fullWidth>
              <Text $variant="h3">Tokens</Text>
              <TokenSelectWrapper>
                {tokenFormKeys.map((path) => {
                  const setToken = path === "token1" ? setToken1 : setToken2;
                  const typeText = path === "token1" ? "Token 1 Type" : "Token 2 Type";
                  return (
                    <div className="input-wrapper" key={`set-token-${path}`}>
                      <Flex>
                        <Text $color="text.secondary" $variant="xs" $mb={1}>
                          {typeText}
                        </Text>
                        <FlexCard $p={1.5} $alignItems="center">
                          <Text $variant="button-link">ERC-20</Text>
                        </FlexCard>
                      </Flex>
                      <Flex>
                        <Text $color="text.secondary" $variant="xs" $mb={1}>
                          Specify token
                        </Text>
                        <TokenAddressInputWithSearch path={path} setToken={setToken} />
                      </Flex>
                    </div>
                  );
                })}
              </TokenSelectWrapper>
            </Flex>
            <Divider />
            {/*
             * Pump Select Section
             */}
            <SectionWrapper>
              <Flex $gap={2} className="description" $justifyContent="flex-start">
                <Text $variant="h3">Pumps</Text>
                <Text $variant="xs">Choose Pump(s) to set up a price feed from your Well.</Text>
              </Flex>
              <Flex className="form-section" $gap={2} $fullWidth>
                <ComponentInputWithCustom<FunctionTokenPumpFormValues>
                  componentType="pumps"
                  path="pumpAddress"
                  dataPath="pumpData"
                  toggleMessage="Use a custom Pump"
                  emptyValue=""
                  additional={additionalOptions}
                  toggleOpen={!!pumpData}
                />
              </Flex>
            </SectionWrapper>
            {/*
             * Actions
             */}
            <CreateWellButtonRow
              onGoBack={handleSave}
              disabled={!token1 || !token2}
              optionalKeys={optionalKeys}
            />
          </Flex>
        </FormInnerWrapper>
      </StyledForm>
    </FormProvider>
  );
};

// ----------------------------------------

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
    formState: {
      errors: { [path]: formError }
    },
    setError,
    clearErrors
  } = useFormContext<FunctionTokenPumpFormValues>();

  const _value = useWatch({ control, name: path });
  const value = typeof _value === "string" ? _value : "";

  const { data: token, error, isLoading } = useERC20TokenWithAddress(value);

  const erc20ErrMessage = error?.message;
  const formErrMessage = formError?.message;

  const tokenAndFormValueMatch = Boolean(
    token && token.address.toLowerCase() === value.toLowerCase()
  );

  useEffect(() => {
    if (erc20ErrMessage) {
      setError(path, { message: erc20ErrMessage });
    } else if (!erc20ErrMessage && formErrMessage === USE_ERC20_TOKEN_ERRORS.notERC20Ish) {
      clearErrors(path);
    }
  }, [path, formErrMessage, erc20ErrMessage, setError, clearErrors]);

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
            required: {
              value: true,
              message: "Token address is required"
            },
            validate: (formValue, formValues) => {
              if (!getIsValidEthereumAddress(formValue)) return "Invalid address";
              const otherTokenValue = formValues[path === "token1" ? "token2" : "token1"];
              const tokensAreSame = formValue.toLowerCase() === otherTokenValue.toLowerCase();
              if (tokensAreSame) return "Unique tokens required";

              return true;
            }
          })}
          placeholder="Search for token or input an address"
          startIcon="search"
          error={formErrMessage ?? erc20ErrMessage}
        />
      ) : (
        <Flex>
          <FoundTokenInfo>
            {token?.logo && (
              <ImgContainer width={16} height={16}>
                {<img src={token.logo} alt={value} />}
              </ImgContainer>
            )}
            <Text $variant="button-link" className="token-symbol">
              {token.symbol}
            </Text>{" "}
            <ImgContainer width={10} height={10} onClick={() => setValue(path, "")}>
              <XIcon width={10} height={10} />
            </ImgContainer>
          </FoundTokenInfo>
          {formErrMessage && (
            <Text $color="error" $variant="xs" $mt={0.5}>
              {formErrMessage ?? erc20ErrMessage}
            </Text>
          )}
        </Flex>
      )}
    </>
  );
};

const FormInnerWrapper = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${theme.spacing(6)};

  ${theme.media.query.sm.only} {
    flex-direction: column;
    gap: ${theme.spacing(4)};
  }
`;

const TokenSelectWrapper = styled(Flex)`
  width: 100%;
  flex-direction: row;
  gap: ${theme.spacing(4)};

  ${theme.media.query.md.down} {
    flex-direction: column;
    gap: ${theme.spacing(3)};
  }

  .input-wrapper {
    display: flex;
    flex-direction: column;
    width: 50%;
    max-width: 50%;
    gap: ${theme.spacing(2)};

    ${theme.media.query.md.down} {
      width: 100%;
      max-width: 100%;
    }
  }
`;

const FoundTokenInfo = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${theme.spacing(1)};
  align-items: center;
  border: 1px solid ${theme.colors.black};
  background: ${theme.colors.primaryLight};
  padding: 9px 16px; // do 9 px instead of theme.spacing(1, 1.5) to match the size of the text input

  .token-symbol {
    position: relative;
    top: 1px;
  }

  svg {
    margin-bottom: 2px;
    cursor: pointer;
  }
`;

const SectionWrapper = styled(Flex)`
  display: flex;
  flex-direction: row;
  width: 100%;
  justify-content: space-between;
  gap: ${theme.spacing(2)};

  ${theme.media.query.md.down} {
    flex-direction: column;
    gap: ${theme.spacing(3)};
  }

  .description {
    max-width: 180px;

    ${theme.media.query.md.down} {
      max-width: 100%;
    }
  }

  .form-section {
    max-width: 713px;
    width: 100%;

    ${theme.media.query.md.down} {
      max-width: 100%;
    }
  }
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
