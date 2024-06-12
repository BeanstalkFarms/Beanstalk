import React from "react";
import { Divider, Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";
import { theme } from "src/utils/ui/theme";
import styled from "styled-components";
import { CreateWellStepProps, useCreateWell } from "./CreateWellProvider";
import { FormProvider, useForm } from "react-hook-form";
import { CreateWellFormProgress } from "./shared/CreateWellFormProgress";
import { StyledForm, TextInputField } from "../Form";
import { useWells } from "src/wells/useWells";
import { CreateWellButtonRow } from "./shared/CreateWellButtonRow";
import { useWhitelistedWellComponents } from "./useWhitelistedWellComponents";

export type WellDetailsFormValues = CreateWellStepProps["step3"];

const useWellDetailsDefaultValues = () => {
  const { components } = useWhitelistedWellComponents();
  const { wellFunctionAddress = "", wellTokens } = useCreateWell();

  const token1 = wellTokens?.token1?.symbol;
  const token2 = wellTokens?.token2?.symbol;

  const whitelistedWellFunction = components.wellFunctions.find(
    (wf) => wf.address.toLowerCase() === wellFunctionAddress?.toLowerCase()
  );

  const componentName = whitelistedWellFunction?.component.name;
  const abbrev = whitelistedWellFunction?.component.tokenSuffixAbbreviation;

  const defaultName =
    componentName && token1 && token2 ? `${token1}:${token2} ${componentName}` : undefined;

  const defaultSymbol = abbrev && token1 && token2 && `${token1}${token2}${abbrev}`;

  return {
    name: defaultName,
    symbol: defaultSymbol
  };
};

const NameAndSymbolForm = () => {
  const { data: wells } = useWells();
  const { wellDetails, setStep3 } = useCreateWell();
  const defaults = useWellDetailsDefaultValues();

  const methods = useForm<WellDetailsFormValues>({
    defaultValues: {
      name: wellDetails?.name || defaults?.name || "",
      symbol: wellDetails?.symbol || defaults?.symbol || ""
    }
  });

  const handleSave = () => {
    const values = methods.getValues();
    setStep3(values);
  };

  const onSubmit = async (values: WellDetailsFormValues) => {
    const valid = await methods.trigger();
    console.log("valid", valid);
    if (!valid) return;
    setStep3({ ...values, goNext: true });
  };

  return (
    <FormProvider {...methods}>
      <StyledForm onSubmit={methods.handleSubmit(onSubmit)} $width="100%">
        <FormInnerWrapper>
          <CreateWellFormProgress />
          <Flex $fullWidth $gap={4}>
            <div>
              <Text $variant="h3" $mb={2}>
                Name and Symbol
              </Text>
              <Flex className="component-inputs-wrapper">
                <Flex className="input-wrapper">
                  <Text $variant="xs" $color="text.secondary" $mb={1}>
                    Well Token Name
                  </Text>
                  <TextInputField
                    {...methods.register("name", {
                      required: {
                        value: true,
                        message: "Token Name is required"
                      },
                      validate: (value) => {
                        const duplicate = (wells || []).some(
                          (well) => well.name?.toLowerCase() === value.toLowerCase()
                        );

                        return !duplicate || "Token name taken";
                      }
                    })}
                    error={methods.formState.errors.name?.message as string | undefined}
                  />
                </Flex>
                <Flex className="input-wrapper">
                  <Text $variant="xs" $color="text.secondary" $mb={1}>
                    Well Token Symbol
                  </Text>
                  <TextInputField
                    {...methods.register("symbol", {
                      required: {
                        value: true,
                        message: "Token Symbol is required"
                      },
                      validate: (value) => {
                        const duplicate = (wells || []).some(
                          (well) => well?.lpToken?.symbol.toLowerCase() === value.toLowerCase()
                        );
                        return !duplicate || "Token symbol taken";
                      }
                    })}
                    error={methods.formState.errors.symbol?.message as string | undefined}
                  />
                </Flex>
              </Flex>
            </div>
            <Divider />
            <CreateWellButtonRow onGoBack={handleSave} />
          </Flex>
        </FormInnerWrapper>
      </StyledForm>
    </FormProvider>
  );
};

export const CreateWellStep3 = () => {
  return (
    <Flex $gap={3} $fullWidth>
      <div>
        <Text $variant="h2">Well Name and Symbol</Text>
        <Subtitle>Give your Well LP token a name and a symbol.</Subtitle>
      </div>
      <NameAndSymbolForm />
    </Flex>
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

  .component-inputs-wrapper {
    flex-direction: row;
    width: 100%;
    gap: ${theme.spacing(4)};

    .input-wrapper {
      width: 50%;
      max-width: 50%;
    }

    ${theme.media.query.sm.only} {
      gap: ${theme.spacing(2)};
      flex-direction: column;

      .input-wrapper {
        width: 100%;
        max-width: unset;
      }
    }
  }
`;

const Subtitle = styled(Text)`
  margin-top: ${theme.spacing(0.5)};
  color: ${theme.colors.stone};
`;
