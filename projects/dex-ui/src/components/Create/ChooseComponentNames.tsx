import React, { useCallback } from "react";
import { Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";
import { theme } from "src/utils/ui/theme";
import styled from "styled-components";
import { CreateWellProps, useCreateWell } from "./CreateWellProvider";
import { FormProvider, useForm } from "react-hook-form";
import { CreateWellFormProgress } from "./CreateWellFormProgress";

type FormValues = CreateWellProps["wellNameAndSymbol"];

const ChooseComponentNamesForm = () => {
  const { wellNameAndSymbol: cached, setWellNameAndSymbol } = useCreateWell();

  const methods = useForm<FormValues>({
    defaultValues: {
      name: cached?.name ?? "",
      symbol: cached?.symbol ?? ""
    }
  });

  const onSubmit = useCallback(
    (values: FormValues) => {
      // validate
      setWellNameAndSymbol(values);
    },
    [setWellNameAndSymbol]
  );

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <Flex $direction="row" $gap={6}>
          <CreateWellFormProgress />
        </Flex>
      </form>
    </FormProvider>
  );
};

export const ChooseComponentNames = () => {
  return (
    <Flex $gap={3} $fullWidth>
      <div>
        <Text $variant="h2">Well Name and Symbol</Text>
        <Subtitle>Give your Well LP token a name and a symbol.</Subtitle>
      </div>
      <ChooseComponentNamesForm />
    </Flex>
  );
};

const Subtitle = styled(Text)`
  margin-top: ${theme.spacing(0.5)};
  color: ${theme.colors.stone};
`;
