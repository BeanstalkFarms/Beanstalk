import React from "react";
import { CheckIcon, CircleEmptyIcon } from "src/components/Icons";
import { Flex } from "src/components/Layout";
import { theme } from "src/utils/ui/theme";
import { Text } from "src/components/Typography";
import { useFormContext, useWatch } from "react-hook-form";
import { CreateWellProps } from "../CreateWellProvider";
import styled from "styled-components";
import { Link } from "react-router-dom";

type FormValues = CreateWellProps["wellFunctionAndPump"];

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

export const FunctionPumpFormProgress = () => {
  const {
    control,
    formState: {
      errors: { wellFunction: wellFunctionErr, token1: token1Err, token2: token2Err, pump: pumpErr }
    }
  } = useFormContext<FormValues>();
  const values = useWatch({ control: control });

  const wellFunctionValid = !!values.wellFunction && !wellFunctionErr;

  const tokenStepAllHaveValues = Boolean(values.token1 && values.token2);

  const tokenStepNoErrors = !(token1Err || token2Err);

  const pumpStepValid = !!values.pump && !pumpErr;

  return (
    <ProgressContainer>
      <Flex $gap={2}>
        <IndicatorWithLabel label="Select Well Function" checked={wellFunctionValid} />
        <IndicatorWithLabel
          label="Select Tokens"
          checked={tokenStepAllHaveValues && tokenStepNoErrors}
        />
        <IndicatorWithLabel label="Select Pump(s)" checked={pumpStepValid} />
      </Flex>
      <Text $color="text.secondary" $variant="xs">
        Visit the <TextLink to="">component library</TextLink> to learn more about the different
        Well components.
      </Text>
    </ProgressContainer>
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
