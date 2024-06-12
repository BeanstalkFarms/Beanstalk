import React, { useCallback } from "react";
import { FieldValues, Path, PathValue, useFormContext, useWatch } from "react-hook-form";
import { useWhitelistedWellComponents } from "../useWhitelistedWellComponents";
import { useBoolean } from "src/utils/ui/useBoolean";
import { TextInputField } from "../../Form";
import { Flex } from "src/components/Layout";
import { ToggleSwitch } from "src/components/ToggleSwitch";
import { WellComponentAccordionCard } from "./ComponentAccordionCard";
import { Text } from "src/components/Typography";
import { theme } from "src/utils/ui/theme";
import styled from "styled-components";
import { CircleFilledCheckIcon, CircleEmptyIcon } from "../../Icons";
import { getIsValidEthereumAddress } from "src/utils/addresses";

type AdditionalOptionProps = {
  value: string;
  label: string;
  subLabel?: string;
};

type Props<T extends FieldValues> = {
  path: Path<T>;
  dataPath?: Path<T>;
  componentType: keyof ReturnType<typeof useWhitelistedWellComponents>;
  toggleMessage: string;
  emptyValue: PathValue<T, Path<T>>;
  additional?: AdditionalOptionProps[];
  toggleOpen?: boolean;
};

export const ComponentInputWithCustom = <T extends FieldValues>({
  componentType,
  path,
  dataPath,
  toggleMessage,
  emptyValue,
  toggleOpen = false,
  additional
}: Props<T>) => {
  const { [componentType]: wellComponents } = useWhitelistedWellComponents();
  const [usingCustom, { toggle, set: setUsingCustom }] = useBoolean(toggleOpen);

  const {
    control,
    setValue,
    register,
    formState: {
      errors: { [path]: error }
    }
  } = useFormContext<T>();

  const value = useWatch<T>({ control, name: path });

  const handleSetValue = useCallback(
    (_addr: string) => {
      const newValue = (_addr === value ? emptyValue : _addr) as PathValue<T, Path<T>>;
      setUsingCustom(false);
      setValue(path, newValue, { shouldValidate: true });
    },
    [value, path, , emptyValue, setValue, setUsingCustom]
  );

  const handleToggle = useCallback(() => {
    setValue(path, emptyValue);
    if (dataPath) {
      setValue(dataPath, emptyValue);
    }
    toggle();
  }, [setValue, toggle, path, emptyValue, dataPath]);

  // we can always assume that error.message is a string b/c we define the
  // validation here in this component
  const errMessage = (error?.message || "") as string | undefined;

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
      {additional?.map((option, i) => {
        const selected = !usingCustom && option.value === value;
        return (
          <AdditionalOption
            $direction="row"
            $active={selected}
            $gap={2}
            key={`well-functions-option-${option.value}-${i}`}
            onClick={() => handleSetValue(option.value)}
          >
            <Flex $direction="row" $alignItems="center" $fullWidth $gap={2}>
              {selected ? (
                <CircleFilledCheckIcon />
              ) : (
                <CircleEmptyIcon color={theme.colors.lightGray} />
              )}
              <div>
                <Text $variant="xs" $weight="semi-bold">
                  {option.label}
                </Text>
                {option.subLabel && (
                  <Text $variant="xs" $color="text.secondary">
                    {option.subLabel}
                  </Text>
                )}
              </div>
            </Flex>
          </AdditionalOption>
        );
      })}
      <Flex $direction="row" $gap={1}>
        <ToggleSwitch checked={usingCustom} toggle={handleToggle} />
        <Text $variant="xs" color="text.secondary">
          {toggleMessage}
        </Text>
      </Flex>
      {usingCustom && (
        <>
          <TextInputField
            {...register(path, {
              validate: (_value) => {
                return getIsValidEthereumAddress(_value) || "Invalid address";
              }
            })}
            placeholder="Input address"
            error={errMessage}
          />
          {dataPath && <ComponentDataFieldInput path={dataPath} />}
        </>
      )}
    </>
  );
};

const ComponentDataFieldInput = <T extends FieldValues>(props: { path: Path<T> }) => {
  const {
    register,
    formState: {
      errors: { [props.path]: error }
    }
  } = useFormContext<T>();

  const errMessage = (error?.message || "") as string | undefined;

  return (
    <TextInputField
      {...register(props.path, {
        validate: (_value) => {
          return _value.startsWith("0x") || "Invalid input";
        }
      })}
      placeholder="0x data"
      error={errMessage}
    />
  );
};

const AdditionalOption = styled(Flex)<{ $active: boolean }>`
  border: 1px solid ${(props) => (props.$active ? theme.colors.black : theme.colors.lightGray)};
  background: ${(props) => (props.$active ? theme.colors.primaryLight : theme.colors.white)};
  padding: ${theme.spacing(2, 3)};
  cursor: pointer;

  .svg-wrapper {
    min-width: 16px;
    min-height: 16px;
  }
`;
