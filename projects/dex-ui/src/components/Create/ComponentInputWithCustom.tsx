import React from "react";
import { FieldValues, Path, PathValue, useFormContext, useWatch } from "react-hook-form";
import { useWhitelistedWellComponents } from "./useWhitelistedWellComponents";
import { useBoolean } from "src/utils/ui/useBoolean";
import { ethers } from "ethers";
import { AddressInputField } from "../Common/Form";
import { Flex } from "../Layout";
import { ToggleSwitch } from "../ToggleSwitch";
import { WellComponentAccordionCard } from "./ComponentAccordionCard";
import { Text } from "../Typography";

export const ComponentInputWithCustom = <T extends FieldValues>({
  componentType,
  path,
  toggleMessage,
  emptyValue
}: {
  path: Path<T>;
  componentType: keyof ReturnType<typeof useWhitelistedWellComponents>;
  toggleMessage: string;
  emptyValue: PathValue<T, Path<T>>;
}) => {
  const { [componentType]: wellComponents } = useWhitelistedWellComponents();
  const [usingCustom, { toggle, set: setUsingCustom }] = useBoolean();
  const {
    control,
    setValue,
    register,
    formState: {
      errors: { [path]: error }
    }
  } = useFormContext<T>();
  const value = useWatch<T>({ control, name: path });

  const handleSetValue = (_addr: PathValue<T, Path<T>>) => {
    setValue(path, _addr === value ? emptyValue : _addr, {
      shouldValidate: true
    });
    setUsingCustom(false);
  };

  const handleToggle = () => {
    setValue(path, emptyValue);
    toggle();
  };

  const errMessage = typeof error?.message === "string" ? error.message : "";

  return (
    <>
      {wellComponents.map((data, i) => (
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
          {toggleMessage}
        </Text>
      </Flex>
      {usingCustom && (
        <AddressInputField
          {...register(path, {
            validate: (value) => ethers.utils.isAddress(value) || "Invalid address"
          })}
          placeholder="Input address"
          error={errMessage}
        />
      )}
    </>
  );
};
