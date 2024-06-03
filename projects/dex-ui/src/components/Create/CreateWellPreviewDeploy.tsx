import React from "react";
import styled from "styled-components";
import {
  Controller,
  DeepRequired,
  FormProvider,
  useForm,
  useFormContext,
  useWatch
} from "react-hook-form";
import { theme } from "src/utils/ui/theme";

import { SwitchField, TextInputField } from "src/components/Form";
import { Box, Divider, Flex } from "src/components/Layout";
import { SelectCard } from "src/components/Selectable";
import { Text } from "src/components/Typography";

import { CreateWellStepProps, useCreateWell } from "./CreateWellProvider";
import { WellComponentInfo, useWhitelistedWellComponents } from "./useWhitelistedWellComponents";

import { ERC20Token } from "@beanstalk/sdk";
import { TokenInput } from "src/components/Swap/TokenInput";
import { CreateWellButtonRow } from "./shared/CreateWellButtonRow";

type FormValues = DeepRequired<CreateWellStepProps["step4"]> & {
  usingSalt: boolean;
  seedingLiquidity: boolean;
};

const FormContent = () => {
  const { salt, liquidity, setStep4, deployWell } = useCreateWell();
  const methods = useForm<FormValues>({
    defaultValues: {
      usingSalt: !!salt,
      salt: salt,
      seedingLiquidity: Boolean(liquidity.token1Amount || liquidity.token2Amount),
      token1Amount: liquidity.token1Amount?.toString(),
      token2Amount: liquidity.token2Amount?.toString()
    }
  });

  const handleSave = () => {
    const values = methods.getValues();
    setStep4({
      salt: values.salt,
      token1Amount: values.token1Amount,
      token2Amount: values.token2Amount
    });
  };

  const onSubmit = async (data: FormValues) => {
    const k = await deployWell();
    // console.log(data);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <Flex $gap={2}>
          <LiquidityForm />
          <SaltForm />
          <CreateWellButtonRow onGoBack={handleSave} valuesRequired={false} />
        </Flex>
      </form>
    </FormProvider>
  );
};

const LiquidityForm = () => {
  const { wellTokens } = useCreateWell();
  const { control } = useFormContext<FormValues>();
  const seedingLiquidity = useWatch({ control, name: "seedingLiquidity" });

  const token1 = wellTokens.token1;
  const token2 = wellTokens.token2;

  if (!token1 || !token2) return null;

  return (
    <Flex $gap={2}>
      <Flex $direction="row" $gap={1} $alignItems="center">
        <SwitchField control={control} name="seedingLiquidity" />
        <Text $variant="xs" $weight="bold" $mb={-0.5}>
          Seed Well with initial liquidity
        </Text>
      </Flex>
      {seedingLiquidity && (
        <Card $gap={2}>
          <Controller
            name="token1Amount"
            control={control}
            render={({ field }) => {
              return (
                <TokenInput
                  id="seed-liquidity-input-1"
                  token={token1}
                  amount={field.value ? token1.amount(Number(field.value)) : undefined}
                  onAmountChange={(value) => {
                    field.onChange(value.toHuman());
                  }}
                  canChangeToken={false}
                  loading={false}
                  label=""
                  allowNegative={false}
                  balanceLabel="Available"
                  clamp
                />
              );
            }}
          />
          <Controller
            name="token2Amount"
            control={control}
            render={({ field }) => {
              return (
                <TokenInput
                  id="seed-liquidity-input-1"
                  token={token2}
                  amount={field.value ? token2.amount(Number(field.value)) : undefined}
                  onAmountChange={(value) => {
                    field.onChange(value.toHuman());
                  }}
                  canChangeToken={false}
                  loading={false}
                  label=""
                  allowNegative={false}
                  balanceLabel="Available"
                  clamp
                />
              );
            }}
          />
        </Card>
      )}
    </Flex>
  );
};

const SaltForm = () => {
  const { control, register } = useFormContext<FormValues>();
  const usingSalt = useWatch({ control, name: "usingSalt" });

  return (
    <Flex $gap={2}>
      <Flex $direction="row" $gap={1} $alignItems="center">
        <SwitchField control={control} name="usingSalt" />
        <Text $variant="xs" $weight="bold" $mb={-0.5}>
          Deploy Well with a Salt
        </Text>
      </Flex>
      {usingSalt && (
        <TextInputField
          placeholder="Input Salt"
          type="number"
          {...register("salt", {
            min: {
              value: 0,
              message: "Salt cannot be negative"
            },
            validate: (formValue) => {
              if (formValue && !Number.isInteger(formValue)) {
                return "Salt must be an integer";
              }
              return true;
            }
          })}
        />
      )}
    </Flex>
  );
};

const getSelectedCardComponentProps = (
  address: string,
  components: readonly WellComponentInfo[]
): { title: string; subtitle?: string } | undefined => {
  const component = components.find((c) => c.address.toLowerCase() === address.toLowerCase());

  return {
    title: component?.component.name ?? address,
    subtitle: component?.component.summary
  };
};

const WellCreatePreview = () => {
  const { wellImplementation, pump, wellFunction, wellTokens, wellDetails } = useCreateWell();

  if (
    !wellImplementation ||
    !pump ||
    !wellFunction ||
    !wellTokens?.token1 ||
    !wellTokens?.token2 ||
    !wellDetails?.name ||
    !wellDetails?.symbol
  ) {
    return null;
  }

  return (
    <WellCreatePreviewInner
      wellImplementation={wellImplementation}
      wellFunction={wellFunction}
      pump={pump}
      token1={wellTokens.token1}
      token2={wellTokens.token2}
      wellName={wellDetails.name}
      wellSymbol={wellDetails.symbol}
    />
  );
};

type WellCreatePreviewInnerProps = {
  wellImplementation: string;
  pump: string;
  wellFunction: string;
  token1: ERC20Token;
  token2: ERC20Token;
  wellName: string;
  wellSymbol: string;
};

const WellCreatePreviewInner = ({
  wellImplementation,
  pump,
  wellFunction,
  token1,
  token2,
  wellName,
  wellSymbol
}: WellCreatePreviewInnerProps) => {
  const components = useWhitelistedWellComponents();

  return (
    <Flex $gap={2}>
      {/* well implementation */}
      <Flex $gap={1}>
        <Text $variant="h3">Well Implementation</Text>
        <SelectedComponentCard
          {...getSelectedCardComponentProps(wellImplementation, components.wellImplementations)}
        />
      </Flex>
      {/* name & symbol */}
      <Flex $gap={1}>
        <Text $variant="h3">Well Name & Symbol</Text>
        <Text $variant="l" $color="text.secondary">
          Name:{" "}
          <Text as="span" $variant="l" $weight="semi-bold" $color="text.secondary">
            {wellName}
          </Text>
        </Text>
        <Text $variant="l" $color="text.secondary">
          Symbol:{" "}
          <Text as="span" $variant="l" $weight="semi-bold" $color="text.secondary">
            {wellSymbol}
          </Text>
        </Text>
      </Flex>
      {/* Tokens */}
      <Flex $gap={1}>
        <Text $variant="h3">Well Name & Symbol</Text>
        <InlineImgFlex>
          <img src={token1?.logo ?? ""} alt={token1?.name ?? ""} />
          <Text $variant="l">{token1?.symbol ?? ""}</Text>
        </InlineImgFlex>
        <InlineImgFlex>
          <img src={token2?.logo ?? ""} alt={token2?.name ?? ""} />
          <Text $variant="l">{token2?.symbol ?? ""}</Text>
        </InlineImgFlex>
      </Flex>
      {/* Pricing Function */}
      <Flex $gap={1}>
        <Text $variant="h3">Pricing Function</Text>
        <SelectedComponentCard
          {...getSelectedCardComponentProps(wellFunction, components.wellFunctions)}
        />
      </Flex>
      <Flex $gap={1}>
        <Text $variant="h3">Pumps</Text>
        <SelectedComponentCard {...getSelectedCardComponentProps(pump, components.pumps)} />
      </Flex>
    </Flex>
  );
};

export const CreateWellPreviewDeploy = () => {
  return (
    <Flex $fullWidth>
      <div>
        <Text $variant="h2">Preview Deployment</Text>
        <Subtitle>Review selections and deploy your Well.</Subtitle>
      </div>
      <Flex $mt={3}>
        <WellCreatePreview />
      </Flex>
      <Box $my={4}>
        <Divider />
      </Box>
      <FormContent />
    </Flex>
  );
};

const Subtitle = styled(Text).attrs({ $mt: 0.5 })`
  color: ${theme.colors.stone};
`;

// shared components
const SelectedComponentCard = ({ title, subtitle }: { title?: string; subtitle?: string }) => {
  if (!title && !subtitle) return null;

  return (
    <SelectCard selected={true}>
      <div>
        <Text $variant="xs" $weight="bold">
          {title}
        </Text>
        {subtitle ? (
          <Text $variant="xs" $color="text.secondary">
            {subtitle}
          </Text>
        ) : null}
      </div>
    </SelectCard>
  );
};

const Card = styled(Flex).attrs({
  $p: 3,
  $boxSizing: "border-box",
  $fullWidth: true,
  $maxWidth: "430px"
})`
  border: 1px solid ${theme.colors.black};
  background: ${theme.colors.white};
`;

const InlineImgFlex = styled(Flex).attrs({
  $display: "inline-flex",
  $direction: "row",
  $gap: 0.5
})`
  img {
    width: 20px;
    height: 20px;
    max-width: 20px;
    max-height: 20px;
    min-width: 20px;
    min-height: 20px;
  }
`;
