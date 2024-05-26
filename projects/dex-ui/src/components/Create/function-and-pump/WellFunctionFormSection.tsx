import React from "react";
import styled from "styled-components";

import { CreateWellProps } from "../CreateWellProvider";
import { Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";
import { ethers } from "ethers";
import { useFormContext, useWatch } from "react-hook-form";
import { AddressInputField } from "src/components/Common/Form";
import { ToggleSwitch } from "src/components/ToggleSwitch";
import { useBoolean } from "src/utils/ui/useBoolean";
import { WellComponentAccordionCard } from "../ComponentAccordionCard";
import { useWhitelistedWellComponents } from "../useWhitelistedWellComponents";

type FormValues = CreateWellProps["wellFunctionAndPump"];

export const WellFunctionFormSection = () => {
  return (
    <WellFunctionFormWrapper $direction="row" $fullWidth $justifyContent="space-between">
      <Flex $gap={2} className="description">
        <Text $variant="h3">Well Functions</Text>
        <Text $variant="xs" $color="text.secondary">
          Choose a Well Function to determine how the tokens in the Well get priced.
        </Text>
      </Flex>
      <FormSection />
    </WellFunctionFormWrapper>
  );
};

const FormSection = () => {
  const { wellFunctions } = useWhitelistedWellComponents();
  const [usingCustom, { toggle, set: setUsingCustom }] = useBoolean();

  const {
    control,
    register,
    setValue,
    formState: {
      errors: { wellFunction: wellFunctionError }
    }
  } = useFormContext<FormValues>();
  const value = useWatch<FormValues>({ control, name: "wellFunction" });

  const handleSetValue = (_addr: string) => {
    setValue("wellFunction", _addr === value ? "" : _addr, {
      shouldValidate: true
    });
    setUsingCustom(false);
  };

  const handleToggle = () => {
    setValue("wellFunction", "");
    toggle();
  };

  return (
    <>
      <Flex className="well-functions" $gap={2} $fullWidth>
        {wellFunctions.map((data, i) => (
          <WellComponentAccordionCard
            key={`well-functions-${i}`}
            selected={data.address === value}
            setSelected={handleSetValue}
            {...data}
          />
        ))}
        <Flex $direction="row" $gap={1}>
          <ToggleSwitch checked={usingCustom} toggle={handleToggle} />
          <Text $variant="xs" color="text.secondary">
            Use a custom Well Implementation instead
          </Text>
        </Flex>
        {usingCustom && (
          <AddressInputField
            {...register("wellFunction", {
              validate: (value) => ethers.utils.isAddress(value) || "Invalid address"
            })}
            placeholder="Input address"
            error={wellFunctionError?.message}
          />
        )}
      </Flex>
    </>
  );
};

const WellFunctionFormWrapper = styled(Flex)`
  .description {
    max-width: 180px;
  }

  .well-functions {
    max-width: 713px;
    width: 100$;
  }
`;
