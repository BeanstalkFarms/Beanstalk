import React, { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { theme } from "src/utils/ui/theme";
import styled from "styled-components";
import { ButtonPrimary } from "../../Button";
import { LeftArrow, RightArrow } from "../../Icons";
import { Flex } from "../../Layout";
import { useCreateWell } from "../CreateWellProvider";

const ButtonLabels = [
  {
    back: "Back: Choose Aquifer",
    next: "Next: Customize Well"
  },
  {
    back: "Back: Choose Well Implementation",
    next: "Next: Well Name and Symbol"
  },
  {
    back: "Back: Customize Well",
    next: "Next: Preview Deployment"
  },
  {
    back: "Back: Customize Well",
    next: "Deploy Well"
  }
] as const;

export const CreateWellButtonRow = ({
  disabled = false,
  valuesRequired = true,
  optionalKeys,
  onGoBack,
  renderPrimaryCustom
}: {
  disabled?: boolean;
  optionalKeys?: readonly string[];
  valuesRequired?: boolean;
  renderPrimaryCustom?: JSX.Element;
  onGoBack?: () => void;
}) => {
  const { step, goBack } = useCreateWell();

  const navigate = useNavigate();
  const {
    control,
    formState: { errors }
  } = useFormContext();
  const values = useWatch({ control });

  const handleGoBack = () => {
    onGoBack?.();
    if (step === 0) {
      navigate("/build");
    } else {
      goBack();
    }
  };

  const noErrors = !Object.keys(errors).length;

  const hasRequiredValues = useMemo(() => {
    if (!valuesRequired) return true;
    const baseKeys = Object.keys(values);
    const keys = optionalKeys ? baseKeys.filter((key) => !optionalKeys.includes(key)) : baseKeys;

    return keys.every((key) => Boolean(values[key]));
  }, [valuesRequired, optionalKeys, values]);

  const goNextEnabled = noErrors && hasRequiredValues;

  const goBackLabel = ButtonLabels[step].back || "Back";
  const nextLabel = ButtonLabels[step].next || "Next";

  return (
    <Flex $fullWidth $direction="row" $justifyContent="space-between" $gap={2}>
      <ButtonPrimary
        $variant="outlined"
        onClick={(e) => {
          // stop the event from bubbling up
          e.preventDefault();
          e.stopPropagation();
          handleGoBack();
        }}
      >
        <ButtonLabel>
          <LeftArrow width={16} height={16} />
          {goBackLabel}
        </ButtonLabel>
      </ButtonPrimary>
      {renderPrimaryCustom ? (
        renderPrimaryCustom
      ) : (
        <ButtonPrimary type="submit" disabled={!goNextEnabled || disabled}>
          <ButtonLabel>
            {nextLabel}
            <RightArrow width={16} height={16} color={theme.colors.white} />
          </ButtonLabel>
        </ButtonPrimary>
      )}
    </Flex>
  );
};

const ButtonLabel = styled(Flex).attrs({
  $gap: 1,
  $direction: "row",
  $alignItems: "center",
  $justiyContent: "center"
})`
  svg {
    margin-bottom: 2px;
  }

  ${theme.media.query.sm.only} {
    svg {
      display: none;
    }
  }
`;