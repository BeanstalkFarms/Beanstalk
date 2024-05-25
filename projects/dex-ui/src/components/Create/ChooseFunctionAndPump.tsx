import React, { useCallback } from "react";
import styled from "styled-components";
import { CreateWellProps, useCreateWell } from "./CreateWellProvider";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { Flex } from "../Layout";
import { Text } from "../Typography";
import { theme } from "src/utils/ui/theme";
import { useWhitelistedWellComponents } from "./useWhitelistedWellComponents";
import { WellComponentAccordionCard } from "./ComponentAccordionCard";
import { useBoolean } from "src/utils/ui/useBoolean";
import { ToggleSwitch } from "../ToggleSwitch";
import { ethers } from "ethers";
import { AddressInputField } from "../Common/Form";

type FormValues = CreateWellProps["wellFunctionAndPump"];

const ChooseFunctionAndPumpForm = () => {
  const { functionAndPump, setFunctionAndPump } = useCreateWell();
  const methods = useForm<FormValues>({
    defaultValues: {
      wellFunction: functionAndPump?.wellFunction || "",
      token1: {
        type: functionAndPump?.token1.type || "",
        address: functionAndPump?.token1.address || ""
      },
      token2: {
        type: functionAndPump?.token2.type || "",
        address: functionAndPump?.token2.address || ""
      },
      pump: functionAndPump?.pump || ""
    }
  });

  const handleSubmit = useCallback(
    (_: FormValues) => {
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
    },
    [setFunctionAndPump]
  );

  // const methods = useForm<FormValues>();

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmit)} style={{ width: "100%" }}>
        <Flex $direction="row">
          <Flex $fullWidth>
            <WellFunctionFormWrapper $direction="row" $fullWidth $justifyContent="space-between">
              <Flex $gap={2} className="description">
                <Text $variant="h3">Well Functions</Text>
                <Text $variant="xs" $color="text.secondary">
                  Choose a Well Function to determine how the tokens in the Well get priced.
                </Text>
              </Flex>
              <WellFunctionFormSection />
            </WellFunctionFormWrapper>
          </Flex>
        </Flex>
      </form>
    </FormProvider>
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

const WellFunctionFormSection = React.memo(() => {
  const { wellFunctions } = useWhitelistedWellComponents();
  const [usingCustom, { toggle, set }] = useBoolean();

  const {
    watch,
    setValue,
    register,
    formState: {
      errors: { wellFunction: wellFunctionError }
    }
  } = useFormContext<FormValues>();
  const value = watch("wellFunction");

  const handleToggle = () => {
    setValue("wellFunction", "");
    toggle();
  };

  const handleSetValue = (_addr: string) => {
    setValue("wellFunction", _addr === value ? "" : _addr, {
      shouldValidate: true
    });
    set(false);
  };

  return (
    <Flex className="well-functions" $gap={2}>
      {wellFunctions.map((data, i) => (
        <WellComponentAccordionCard
          selected={data.address === value}
          setSelected={handleSetValue}
          key={`well-functions-${i}`}
          {...data}
        />
      ))}
      <Flex $direction="row" $gap={1}>
        <ToggleSwitch checked={usingCustom} toggle={handleToggle} />
        <Text $variant="xs" color="text.secondary">
          Use a custom Well Implementation instead
        </Text>
      </Flex>
      {usingCustom ? (
        <AddressInputField
          {...register("wellFunction", {
            validate: (value) => ethers.utils.isAddress(value) || "Invalid address"
          })}
          placeholder="Input address"
          error={wellFunctionError?.message}
        />
      ) : null}
    </Flex>
  );
});

export const ChooseFunctionAndPump = () => {
  return (
    <Flex $gap={3} $fullWidth>
      <div>
        <Text $variant="h2">Create a Well - Choose a Well Function and Pump</Text>
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
