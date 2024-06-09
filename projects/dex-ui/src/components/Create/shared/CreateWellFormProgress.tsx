import React, { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { theme } from "src/utils/ui/theme";
import { CheckIcon, CircleEmptyIcon } from "src/components/Icons";
import { Flex } from "src/components/Layout";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Text } from "src/components/Typography";
import { FunctionTokenPumpFormValues } from "../ChooseFunctionAndPump";
import { WellDetailsFormValues } from "../ChooseComponentNames";

type ViableProps = Omit<FunctionTokenPumpFormValues, "wellFunctionData" | "pumpData"> &
  WellDetailsFormValues;

const progressOrder = {
  // Well Function & Pump Steps
  ["Select Well Function"]: 0,
  ["Select Tokens"]: 1,
  ["Select Pump(s)"]: 2,

  // Well Name & Symbol Steps
  ["Well Name"]: 0,
  ["Well Symbol"]: 1
} as const;

type OrderKey = keyof typeof progressOrder;

const progressLabelMap: Record<keyof ViableProps, string> = {
  // Well Function & Pump Steps
  wellFunctionAddress: "Select Well Function",
  token1: "Select Tokens",
  token2: "Select Tokens",
  pumpAddress: "Select Pump(s)",
  // Well Name & Symbol Steps
  name: "Well Name",
  symbol: "Well Symbol"
} as const;

export const CreateWellFormProgress = () => {
  const {
    control,
    formState: { errors }
  } = useFormContext();
  const values = useWatch({ control: control });

  const labelToProgress = useMemo(() => {
    const progressMap = {} as Record<string, boolean>;

    // We assume that 'defaultValue' is always passed into the form. Otherwise
    for (const key in values) {
      if (!(key in progressLabelMap)) continue;
      const progressKey = progressLabelMap[key as keyof typeof progressLabelMap];

      const value = values[key as keyof typeof values];
      const hasError = Boolean(key in errors && errors[key]?.message);

      const isFinished = Boolean(value) && !hasError;

      if (progressKey && progressKey in progressMap) {
        progressMap[progressKey] = progressMap[progressKey] && isFinished;
      } else {
        progressMap[progressKey] = isFinished;
      }
    }

    return Object.entries(progressMap).sort(([_aKey], [_bKey]) => {
      const a = progressOrder[_aKey as OrderKey];
      const b = progressOrder[_bKey as OrderKey];
      return a - b;
    });
  }, [errors, values]);

  return (
    <ProgressContainer>
      <Flex $gap={2}>
        {labelToProgress.map(([label, checked], i) => (
          <IndicatorWithLabel label={label} checked={checked} key={`indicator-${label}-${i}`} />
        ))}
      </Flex>
      <Text $color="text.secondary" $variant="xs">
        Visit the{" "}
        <TextLink
          // TODO: FIX ME
          to=""
        >
          component library
        </TextLink>{" "}
        to learn more about the different Well components.
      </Text>
    </ProgressContainer>
  );
};

const IndicatorWithLabel = ({ label, checked }: { label: string; checked: boolean }) => {
  return (
    <Flex $direction="row" $fullWidth $justifyContent="space-between" $alignItems="center">
      <Text $variant="xs" $color={checked ? "text.primary" : "text.light"}>
        {label}
      </Text>
      {checked ? (
        <CheckIcon width={20} height={20} />
      ) : (
        <NudgeLeft>
          <CircleEmptyIcon width={12} height={12} color={theme.colors.lightGray} />
        </NudgeLeft>
      )}
    </Flex>
  );
};

const NudgeLeft = styled.div`
  display: flex;
  margin-right: 5px;
`;

const ProgressContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing(4)};
  width: 100%;
  max-width: 182px;
`;

const TextLink = styled(Link)`
  ${theme.font.styles.variant("xs")}
  color: ${theme.font.color("text.light")};
  text-decoration: underline;
`;
