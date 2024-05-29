import React from "react";
import styled from "styled-components";

import { theme } from "src/utils/ui/theme";

import { Text } from "src/components/Typography";
import { Flex } from "src/components/Layout";
import { FormProvider, useForm } from "react-hook-form";
import { useCreateWell } from "./CreateWellProvider";
import { useTokenMetadata } from "src/utils/token/useTokenMetadata";
import { SelectIndicatorIcon } from "../Selectable";

const FormContent = () => {
  const methods = useForm();

  const onSubmit = (data: any) => {
    console.log(data);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <div>asdf</div>
      </form>
    </FormProvider>
  );
};

const Preview = () => {
  const { wellImplementation, functionAndPump, wellNameAndSymbol } = useCreateWell();

  const token1Metadata = useTokenMetadata(functionAndPump?.token1 || "");
  const token2Metadata = useTokenMetadata(functionAndPump?.token2 || "");

  return (
    <Flex>
      <Text $variant="h3">Well Implementation</Text>
    </Flex>
  );
};

export const CreateWellPreviewDeploy = () => {
  return (
    <Flex $gap={3} $fullWidth>
      <div>
        <Text $variant="h2">Preview Deployment</Text>
        <Subtitle>Review selections and deploy your Well.</Subtitle>
      </div>
      <FormContent />
    </Flex>
  );
};

const Subtitle = styled(Text)`
  margin-top: ${theme.spacing(0.5)};
  color: ${theme.colors.stone};
`;

// shared components

export type SelectWithLabelValueProps = {
  selected: boolean;
  label: string;
  value: string;
};

const SelectWithLabelValue = ({ selected, label, value }: SelectWithLabelValueProps) => {
  return (
    <SelectedWrapper $direction="row" $fullWidth $alignItems="center" $px={3} $py={2}>
      <SelectIndicatorIcon selected={selected} />
      <div>
        <Text $variant="xs" $weight="bold">
          {label}
        </Text>
        <Text $variant="xs" $color="text.secondary">
          {value}
        </Text>
      </div>
    </SelectedWrapper>
  );
};

const SelectedWrapper = styled(Flex)`
  border: 1px solid ${theme.colors.black};
  background: ${theme.colors.primaryLight};
`;
