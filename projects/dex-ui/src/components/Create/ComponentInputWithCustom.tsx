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
import { theme } from "src/utils/ui/theme";
import styled from "styled-components";
import { CircleFilledCheckIcon, CircleEmptyIcon } from "../Icons";

type Props<T extends FieldValues> = {
  path: Path<T>;
  componentType: keyof ReturnType<typeof useWhitelistedWellComponents>;
  toggleMessage: string;
  emptyValue: PathValue<T, Path<T>>;
  noneOption?: {
    description?: string;
  };
};

export const ComponentInputWithCustom = <T extends FieldValues>({
  componentType,
  path,
  toggleMessage,
  emptyValue,
  noneOption
}: Props<T>) => {
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

  const handleSetValue = (_addr: string) => {
    const newValue = (_addr === "none" ? "none" : _addr) as PathValue<T, Path<T>>;
    setUsingCustom(false);
    setValue(path, newValue, { shouldValidate: true });
  };

  const handleToggle = () => {
    setValue(path, emptyValue);
    toggle();
  };

  // we can always assume that error.message is a string b/c we define the
  // validation here in this component
  const errMessage = typeof error?.message as string;

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
      {noneOption && (
        <EmptyOption
          selected={value === "none"}
          onClick={() => handleSetValue("none" as PathValue<T, Path<T>>)}
          {...noneOption}
        />
      )}
      <Flex $direction="row" $gap={1}>
        <ToggleSwitch checked={usingCustom} toggle={handleToggle} />
        <Text $variant="xs" color="text.secondary">
          {toggleMessage}
        </Text>
      </Flex>
      {usingCustom && (
        <AddressInputField
          {...register(path, {
            validate: (value) => {
              if (noneOption && value === "none") return true;
              return ethers.utils.isAddress(value) || "Invalid address";
            }
          })}
          placeholder="Input address"
          error={errMessage}
        />
      )}
    </>
  );
};

const EmptyOption = ({
  selected,
  description,
  onClick
}: {
  selected: boolean;
  description?: string;
  onClick: () => void;
}) => {
  return (
    <EmptyOptionWrapper $direction="row" $active={selected} onClick={onClick}>
      <Flex $direction="row" $alignItems="center" $fullWidth $gap={2}>
        {selected ? <CircleFilledCheckIcon /> : <CircleEmptyIcon color={theme.colors.lightGray} />}
        <div>
          <Text $variant="xs" $weight="semi-bold">
            None
          </Text>
          {description && (
            <Text $variant="xs" $color="text.secondary">
              {description}
            </Text>
          )}
        </div>
      </Flex>
    </EmptyOptionWrapper>
  );
};

const EmptyOptionWrapper = styled(Flex).attrs({ $gap: 2 })<{ $active: boolean }>`
  border: 1px solid ${(props) => (props.$active ? theme.colors.black : theme.colors.lightGray)};
  background: ${(props) => (props.$active ? theme.colors.primaryLight : theme.colors.white)};
  padding: ${theme.spacing(2, 3)};
  cursor: pointer;
`;
