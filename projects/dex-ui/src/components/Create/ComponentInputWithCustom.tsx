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

export const ComponentInputWithCustom = <T extends FieldValues>({
  componentType,
  path,
  toggleMessage,
  emptyValue,
  noneOption
}: {
  path: Path<T>;
  componentType: keyof ReturnType<typeof useWhitelistedWellComponents>;
  toggleMessage: string;
  emptyValue: PathValue<T, Path<T>>;
  noneOption?: {
    description?: string;
  };
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
      {noneOption && (
        <EmptyOption
          selected={value === "none"}
          subLabel={noneOption.description}
          onClick={() => handleSetValue("none" as PathValue<T, Path<T>>)}
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
  subLabel,
  onClick
}: {
  selected: boolean;
  subLabel?: string;
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
          {subLabel && (
            <Text $variant="xs" $color="text.secondary">
              {subLabel}
            </Text>
          )}
        </div>
      </Flex>
    </EmptyOptionWrapper>
  );
};

const EmptyOptionWrapper = styled(Flex).attrs({ $gap: 2 })<{ $active: boolean }>`
  // width: 100%;
  border: 1px solid ${(props) => (props.$active ? theme.colors.black : theme.colors.lightGray)};
  background: ${(props) => (props.$active ? theme.colors.primaryLight : theme.colors.white)};
  padding: ${theme.spacing(2, 3)};
  cursor: pointer;
`;
