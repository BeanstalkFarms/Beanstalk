import React from "react";
import styled from "styled-components";
import { Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";
import { ToggleSwitch } from "src/components/ToggleSwitch";
import { ButtonPrimary } from "src/components/Button";
import { useNavigate } from "react-router-dom";
import { useBoolean } from "src/utils/ui/useBoolean";
import { AddressInputField } from "src/components/Common/Form";
import { Form, FormSubmitHandler, useForm } from "react-hook-form";
import { ethers } from "ethers";
import { CreateWellProps, useCreateWell } from "./CreateWellProvider";
import { useWhitelistedWellComponents } from "./useWhitelistedWellComponents";
import { WellComponentAccordionCard } from "./ComponentAccordionCard";

type FormType = CreateWellProps["wellImplementation"];

const ChooseWellImplementationForm = () => {
  const navigate = useNavigate();

  const { wellImplementation, setWellImplementation } = useCreateWell();
  const [usingCustomWell, { toggle, set: setBool }] = useBoolean();
  const { wellImplementations: entries } = useWhitelistedWellComponents();

  const {
    register,
    setValue,
    watch,
    control,
    formState: { errors }
  } = useForm<FormType>({
    defaultValues: { wellImplementation: "" },
    values: { wellImplementation: wellImplementation?.wellImplementation || "" }
  });

  const value = watch("wellImplementation");

  const handleToggle = () => {
    setValue("wellImplementation", "");
    toggle();
  };

  const handleSetSelected = (_addr: string) => {
    setValue("wellImplementation", _addr === value ? "" : _addr, {
      shouldValidate: true
    });
    setBool(false);
  };

  const handleSubmit: FormSubmitHandler<FormType> = ({ data: { wellImplementation } }) => {
    if (!!Object.keys(errors).length) return;
    if (!ethers.utils.isAddress(wellImplementation)) return;
    if (wellImplementation) {
      setWellImplementation({ wellImplementation: wellImplementation, goNext: true });
    }
  };

  const canSubmit = !!(value && !Object.keys(errors).length);

  return (
    <Form onSubmit={handleSubmit} control={control} style={{ width: "100%" }}>
      <FormWrapperInner $gap={2} $fullWidth>
        <Uppercase $lineHeight="l">Which Well Implementation do you want to use?</Uppercase>
        {entries.map((entry, i) => (
          <WellComponentAccordionCard
            {...entry}
            selected={entry.address === value}
            setSelected={handleSetSelected}
            key={`well-implementation-card-${i}`}
          />
        ))}
        <Flex $direction="row" $gap={1}>
          <ToggleSwitch checked={usingCustomWell} toggle={handleToggle} />
          <Text $variant="xs" color="text.secondary">
            Use a custom Well Implementation instead
          </Text>
        </Flex>
        {usingCustomWell ? (
          <AddressInputField
            {...register("wellImplementation", {
              validate: (value) => ethers.utils.isAddress(value) || "Invalid address"
            })}
            placeholder="Input address"
            error={errors.wellImplementation?.message}
          />
        ) : null}
        <Flex $fullWidth $direction="row" $justifyContent="space-between">
          <ButtonPrimary $variant="outlined" onClick={() => navigate("/build")}>
            Back: Choose Aquifer
          </ButtonPrimary>
          <ButtonPrimary type="submit" disabled={!canSubmit}>
            Next: Customize Well
          </ButtonPrimary>
        </Flex>
      </FormWrapperInner>
    </Form>
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
