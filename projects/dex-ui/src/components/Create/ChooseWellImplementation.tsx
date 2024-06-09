import React, { useCallback } from "react";
import { Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";

import { FormProvider, useForm } from "react-hook-form";
import { CreateWellStepProps, useCreateWell } from "./CreateWellProvider";
import { ComponentInputWithCustom } from "./shared/ComponentInputWithCustom";
import { CreateWellButtonRow } from "./shared/CreateWellButtonRow";
import styled from "styled-components";
import { theme } from "src/utils/ui/theme";

type FormValues = CreateWellStepProps["step1"];

const ChooseWellImplementationForm = () => {
  const { wellImplementation, setStep1 } = useCreateWell();

  const methods = useForm<FormValues>({
    defaultValues: { wellImplementation: wellImplementation ?? "" }
  });

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      const isValidated = await methods.trigger();
      if (!isValidated) return;

      setStep1({ ...values, goNext: true });
    },
    [methods, setStep1]
  );

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmit)} style={{ width: "100%" }}>
        <Flex $maxWidth={"710px"} $fullWidth $gap={2}>
          <Text $lineHeight="l">
            {"Which Well Implementation do you want to use?".toUpperCase()}
          </Text>
          <ComponentInputWithCustom
            componentType="wellImplementations"
            path="wellImplementation"
            toggleMessage="Use a custom Well Implementation instead"
            emptyValue=""
          />
          <CreateWellButtonRow />
        </Flex>
      </form>
    </FormProvider>
  );
};

// ----------------------------------------

export const ChooseWellImplementation = () => {
  return (
    <Flex $gap={3} $fullWidth>
      <Text $variant="h2">Create a Well - Choose a Well Implementation</Text>
      <ContentWrapper>
        <div className="text-section">
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
        </div>
        <ChooseWellImplementationForm />
      </ContentWrapper>
    </Flex>
  );
};

const ContentWrapper = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${theme.spacing(8)};
  align-items: flex-start;

  ${theme.media.query.sm.only} {
    flex-direction: column;
    gap: ${theme.spacing(4)};
  }

  .text-section {
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(2)};
    max-width: 274px;

    ${theme.media.query.sm.only} {
      max-width: 100%;
      gap: ${theme.spacing(2)};
    }
  }
  //
`;

// const TextSection = styled.div`
//   display: flex;
//   flex-direction: column;
//   gap: ${theme.spacing(2)};
//   max-width: 274px;

//   ${theme.media.query.sm.only} {
//     max-width: 100%;
//     gap: ${theme.spacing(1)};
//   }
// `;
