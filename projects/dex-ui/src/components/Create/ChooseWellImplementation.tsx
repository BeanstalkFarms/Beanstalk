import React from "react";
import styled from "styled-components";
import { Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";

import { ButtonPrimary } from "src/components/Button";
import { useNavigate } from "react-router-dom";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { ethers } from "ethers";
import { CreateWellProps, useCreateWell } from "./CreateWellProvider";
import { ComponentInputWithCustom } from "./ComponentInputWithCustom";

type FormType = CreateWellProps["wellImplementation"];

const ChooseWellImplementationForm = () => {
  const navigate = useNavigate();

  const { wellImplementation, setWellImplementation } = useCreateWell();

  const methods = useForm<FormType>({
    defaultValues: { wellImplementation: "" },
    values: { wellImplementation: wellImplementation?.wellImplementation || "" }
  });

  const handleSubmit = ({ wellImplementation }: FormType) => {
    if (!ethers.utils.isAddress(wellImplementation)) return;
    if (wellImplementation) {
      setWellImplementation({ wellImplementation: wellImplementation, goNext: true });
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmit)} style={{ width: "100%" }}>
        <FormWrapperInner $gap={2} $fullWidth>
          <Uppercase $lineHeight="l">Which Well Implementation do you want to use?</Uppercase>
          <ComponentInputWithCustom
            componentType="wellImplementations"
            path="wellImplementation"
            toggleMessage="Use a custom Well Implementation instead"
          />
          <Flex $fullWidth $direction="row" $justifyContent="space-between">
            <ButtonPrimary $variant="outlined" onClick={() => navigate("/build")}>
              Back: Choose Aquifer
            </ButtonPrimary>
            <SubmitButton />
          </Flex>
        </FormWrapperInner>
      </form>
    </FormProvider>
  );
};

const SubmitButton = () => {
  const {
    formState: { errors }
  } = useFormContext<FormType>();

  const canSubmit = !!Object.keys(errors).length;

  return (
    <ButtonPrimary type="submit" disabled={!canSubmit}>
      Next: Customize Well
    </ButtonPrimary>
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
