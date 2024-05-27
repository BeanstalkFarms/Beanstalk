import React, { useCallback } from "react";
import styled from "styled-components";
import { CreateWellProps, useCreateWell } from "./CreateWellProvider";
import { FormProvider, useForm } from "react-hook-form";
import { Divider, Flex } from "../Layout";
import { Text } from "../Typography";
import { theme } from "src/utils/ui/theme";
import { FunctionPumpFormProgress } from "./function-and-pump/FunctionPumpFormProgress";
import { WellFunctionFormSection } from "./function-and-pump/WellFunctionFormSection";
import { TokenSelectFormSection } from "./function-and-pump/TokenSelectFormSection";

type FormValues = CreateWellProps["wellFunctionAndPump"];

const ChooseFunctionAndPumpForm = () => {
  const { functionAndPump, setFunctionAndPump } = useCreateWell();
  const methods = useForm<FormValues>({
    defaultValues: {
      wellFunction: functionAndPump?.wellFunction || "",
      token1: functionAndPump?.token1 || "",
      token2: functionAndPump?.token2 || "",
      pump: functionAndPump?.pump || ""
    }
  });

  const handleSubmit = useCallback(
    (_: FormValues) => {
      // TODO: Implement
      setFunctionAndPump({
        wellFunction: "",
        token1: "",
        token2: "",
        pump: ""
      });
    },
    [setFunctionAndPump]
  );

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmit)} style={{ width: "100%" }}>
        <Flex $direction="row" $gap={6}>
          {/*  */}
          <FunctionPumpFormProgress />
          {/*  */}
          <Flex $fullWidth $gap={4}>
            <WellFunctionFormSection />
            <Divider />
            <TokenSelectFormSection />
            <Divider />
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
        <Text $variant="h2">Create a Well - Choose a Well Function and 0Pump</Text>
        <Subtitle>Select the components to use in your Well.</Subtitle>
      </div>
      <ChooseFunctionAndPumpForm />
    </Flex>
  );
};

const Subtitle = styled(Text)`
  margin-top: ${theme.spacing(0.5)};
  color: ${theme.colors.stone};
`;
