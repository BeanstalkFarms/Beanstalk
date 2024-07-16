import React from "react";
import { Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";

import { FormProvider, useForm } from "react-hook-form";
import { CreateWellStepProps, useCreateWell } from "./CreateWellProvider";
import { ComponentInputWithCustom } from "./shared/ComponentInputWithCustom";
import { CreateWellButtonRow } from "./shared/CreateWellButtonRow";
import styled from "styled-components";
import { theme } from "src/utils/ui/theme";
import { StyledForm } from "../Form";

type FormValues = CreateWellStepProps["step1"];

const WellImplementationForm = () => {
  const { wellImplementation, setStep1 } = useCreateWell();

  const methods = useForm<FormValues>({
    defaultValues: { wellImplementation: wellImplementation ?? "" }
  });

  const handleSubmit = async (values: FormValues) => {
    const isValidated = await methods.trigger();
    if (!isValidated) return;

    setStep1({ ...values, goNext: true });
  };

  return (
    <FormProvider {...methods}>
      <StyledForm onSubmit={methods.handleSubmit(handleSubmit)} $width="100%">
        <Flex $gap={2}>
          <ComponentInputWithCustom
            componentType="wellImplementations"
            path="wellImplementation"
            toggleMessage="Use a custom Well Implementation instead"
            emptyValue=""
          />
          <CreateWellButtonRow />
        </Flex>
      </StyledForm>
    </FormProvider>
  );
};

// ----------------------------------------

export const CreateWellStep1 = () => {
  return (
    <Flex $gap={3} $fullWidth>
      <Text $variant="h2">Create a Well - Choose a Well Implementation</Text>
      <ContentWrapper>
        <Flex className="text-section">
          <Text $color="text.secondary" $lineHeight="l">
            Deploy a Well using Aquifer, a Well factory contract.
          </Text>
          <Text $color="text.secondary" $lineHeight="l">
            It is recommended to use the Well.sol Well Implementation, but you&apos;re welcome to
            use a custom contract.
          </Text>
          <Text $color="text.secondary" $lineHeight="l">
            Visit the documentation to learn more about Aquifers and Well Implementations.
          </Text>
        </Flex>
        <Flex className="form-section">
          <Text $lineHeight="l">
            {"Which Well Implementation do you want to use?".toUpperCase()}
          </Text>
          <WellImplementationForm />
        </Flex>
      </ContentWrapper>
    </Flex>
  );
};

const contentMaxWidth = "1048px";

const ContentWrapper = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${theme.spacing(8)};
  align-items: flex-start;
  justify-content: space-between;
  max-width: ${contentMaxWidth};
  width: 100%;

  ${theme.media.query.sm.only} {
    flex-direction: column;
    gap: ${theme.spacing(4)};
  }

  .text-section {
    gap: ${theme.spacing(2)};
    max-width: 274px;
    min-width: 225px;
    width: 100%;
    flex-shrink: 2;

    ${theme.media.query.sm.only} {
      max-width: 100%;
      gap: ${theme.spacing(2)};
    }
  }

  .form-section {
    gap: ${theme.spacing(2)};
    max-width: 710px;
    width: 100%;
  }
`;
