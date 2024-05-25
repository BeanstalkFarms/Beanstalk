import React from "react";
import { CreateWellProps, useCreateWell } from "./CreateWellProvider";
import { Form, useForm } from "react-hook-form";
import { Flex } from "../Layout";
import { Text } from "../Typography";
import styled from "styled-components";
import { theme } from "src/utils/ui/theme";

type FormType = CreateWellProps["wellFunctionAndPump"];

const ChooseFunctionAndPumpForm = () => {
  const { setFunctionAndPump } = useCreateWell();

  const handleSubmit = () => {
    // TODO: Implement
    setFunctionAndPump({
      wellFunction: "",
      token1: {
        type: "",
        address: ""
      },
      token2: {
        type: "",
        address: ""
      },
      pump: ""
    });
  };

  const form = useForm<FormType>();

  return <Form {...form} onSubmit={handleSubmit}></Form>;
};

const ChooseFunctionAndPumpContent = () => {
  return (
    <Flex $gap={3} $fullWidth>
      <div>
        <Text $variant="h2">Create a Well - Choose a Well Function and Pump</Text>
        <Subtitle>Select the components to use in your Well.</Subtitle>
      </div>
      <Flex $direction="row"></Flex>
      <ChooseFunctionAndPumpForm />
    </Flex>
  );
};

const Subtitle = styled(Text)`
  margin-top: ${theme.spacing(0.5)};
  color: ${theme.colors.stone};
`;

export const ChooseFunctionAndPump = React.memo(ChooseFunctionAndPumpContent);
