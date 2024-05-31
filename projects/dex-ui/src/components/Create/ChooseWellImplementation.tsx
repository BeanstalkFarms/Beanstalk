import React from "react";
import styled from "styled-components";
import { Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";

import { FormProvider, useForm } from "react-hook-form";
import { ethers } from "ethers";
import { CreateWellStepProps, useCreateWell } from "./CreateWellProvider";
import { ComponentInputWithCustom } from "./shared/ComponentInputWithCustom";
import { CreateWellButtonRow } from "./shared/CreateWellButtonRow";

type FormValues = CreateWellStepProps["step1"];

const ChooseWellImplementationForm = () => {
  const { wellImplementation, setStep1 } = useCreateWell();

  const methods = useForm<FormValues>({
    defaultValues: { wellImplementation: wellImplementation ?? "" }
  });

  const handleSubmit = ({ wellImplementation }: FormValues) => {
    if (!ethers.utils.isAddress(wellImplementation)) return;
    if (wellImplementation) {
      setStep1({ wellImplementation: wellImplementation, goNext: true });
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmit)} style={{ width: "100%" }}>
        <FormWrapperInner $gap={2} $fullWidth>
          <Uppercase $lineHeight="l">Which Well Implementation do you want to use?</Uppercase>
          <ComponentInputWithCustom<FormValues>
            componentType="wellImplementations"
            path="wellImplementation"
            toggleMessage="Use a custom Well Implementation instead"
            emptyValue=""
          />
          <CreateWellButtonRow />
        </FormWrapperInner>
      </form>
    </FormProvider>
  );
};

const Uppercase = styled(Text)`
  text-transform: uppercase;
`;

const FormWrapperInner = styled(Flex)`
  max-width: 710px;
  width: 100%;
`;

// ----------------------------------------

export const ChooseWellImplementation = () => {
  return (
    <Flex $gap={3} $fullWidth>
      <Text $variant="h2">Create a Well - Choose a Well Implementation</Text>
      <Flex $direction="row" $alignItems="flex-start" $gap={8}>
        <InstructionContainer>
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
        </InstructionContainer>
        <ChooseWellImplementationForm />
      </Flex>
    </Flex>
  );
};

const InstructionContainer = styled(Flex).attrs({ $gap: 2 })`
  max-width: 274px;
`;
