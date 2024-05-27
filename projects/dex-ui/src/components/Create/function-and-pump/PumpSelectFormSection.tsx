import React from "react";
import { useFormContext } from "react-hook-form";
import { CreateWellProps } from "../CreateWellProvider";
import { Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";

type FormValues = CreateWellProps["wellFunctionAndPump"];

export const PumpSelectFormSection = () => {
  const form = useFormContext<FormValues>();

  return (
    <Flex $direction="row" $alignItems="center">
      <Flex $gap={2}>
        <Text $variant="h3">Pumps</Text>
        <Text $variant="xs">Choose Pump(s) to set up a price feed from your Well.</Text>
      </Flex>
    </Flex>
  );
};
