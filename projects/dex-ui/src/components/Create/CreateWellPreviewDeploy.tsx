import React, { useEffect } from "react";
import styled from "styled-components";
import { Controller, FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { theme } from "src/utils/ui/theme";

import { SwitchField, TextInputField } from "src/components/Form";
import { Box, Divider, Flex, FlexCard } from "src/components/Layout";
import { SelectCard } from "src/components/Selectable";
import { Text } from "src/components/Typography";

import { CreateWellStepProps, useCreateWell } from "./CreateWellProvider";
import { WellComponentInfo, useWhitelistedWellComponents } from "./useWhitelistedWellComponents";

import { ERC20Token } from "@beanstalk/sdk";
import { TokenInput } from "src/components/Swap/TokenInput";
import { CreateWellButtonRow } from "./shared/CreateWellButtonRow";

type FormValues = CreateWellStepProps["step4"] & {
  usingSalt: boolean;
  seedingLiquidity: boolean;
};

const FormContent = () => {
  const { salt, liquidity, setStep4, deployWell, wellTokens } = useCreateWell();
  const methods = useForm<FormValues>({
    defaultValues: {
      usingSalt: !!salt,
      salt: salt,
      seedingLiquidity: !!(liquidity.token1Amount || liquidity.token2Amount),
      token1Amount: liquidity.token1Amount?.toString() || "",
      token2Amount: liquidity.token2Amount?.toString() || ""
    }
  });

  const handleSave = (formValues?: FormValues) => {
    const values = formValues || methods.getValues();
    setStep4({
      salt: values.usingSalt ? values.salt : undefined,
      token1Amount: values.seedingLiquidity ? values.token1Amount : undefined,
      token2Amount: values.seedingLiquidity ? values.token2Amount : undefined
    });
  };

  const onSubmit = async (values: FormValues) => {
    handleSave(values);

    if (!wellTokens.token1 || !wellTokens.token2) return;

    const token1Amount = wellTokens.token1.fromHuman(Number(values.token1Amount || "0"));
    const token2Amount = wellTokens.token2.fromHuman(Number(values.token2Amount || "0"));

    // We determine that the user is seeding liquidity if they have 'seeding liquidity' toggled on in the CURRENT form
    // and if they have provided a non-zero amount for at least 1 token.
    const seedingLiquidity =
      values.seedingLiquidity && Boolean(token1Amount.gt(0) || token2Amount.gt(0));

    // Always use the salt value from the current form.
    const saltValue = (values.usingSalt && values.salt) || 0;

    const liquidity =
      seedingLiquidity && token1Amount && token2Amount ? { token1Amount, token2Amount } : undefined;

    await deployWell(saltValue, liquidity);
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
        <FlexCard $gap={2} $p={3} $boxSizing="border-box" $fullWidth $maxWidth="430px">
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
        </FlexCard>
      )}
    </Flex>
  );
};

const useSaltInputOpenDynamic = () => {
  const { control, setValue } = useFormContext<FormValues>();

  const seedingLiquidity = useWatch({ control, name: "seedingLiquidity" });
  const amount1 = useWatch({ control, name: "token1Amount" });
  const amount2 = useWatch({ control, name: "token2Amount" });

  const usingSalt = useWatch({ control, name: "usingSalt" });
  const salt = useWatch({ control, name: "salt" });

  const noAmounts = !amount1 && !amount2;
  const noSaltValue = !salt;

  useEffect(() => {
    if (seedingLiquidity && !usingSalt) {
      setValue("usingSalt", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedingLiquidity, usingSalt]);

  useEffect(() => {
    if (!seedingLiquidity && noSaltValue && !noAmounts) {
      setValue("usingSalt", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noAmounts, seedingLiquidity, noSaltValue]);
};

const SaltForm = () => {
  const { control, register } = useFormContext<FormValues>();
  const usingSalt = useWatch({ control, name: "usingSalt" });
  useSaltInputOpenDynamic();

  const seedingLiquidity = useWatch({ control, name: "seedingLiquidity" });

  return (
    <Flex $gap={2}>
      <Flex $gap={1}>
        <Flex $direction="row" $gap={1} $alignItems="center">
          <SwitchField control={control} name="usingSalt" disabled={seedingLiquidity} />
          <Text $variant="xs" $weight="bold" $mb={-0.5}>
            Deploy Well with a Salt
          </Text>
        </Flex>
        {usingSalt ? (
          <Text $variant="xs" $color="text.secondary">
            New Wells are deployed using pipeline. Salt should be mined with the pipeline address
          </Text>
        ) : null}
      </Flex>
      {usingSalt && (
        <TextInputField
          placeholder="Input Salt"
          type="number"
          {...register("salt", {
            required: {
              value: seedingLiquidity ? true : false,
              message: "Salt is required when seeding liquidity"
            },
            min: {
              value: 1,
              message: "Salt must be >= 1"
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

const WellCreatePreview = () => {
  const { wellImplementation, pumpAddress, wellFunctionAddress, wellTokens, wellDetails } =
    useCreateWell();

  if (
    !wellImplementation ||
    !pumpAddress ||
    !wellFunctionAddress ||
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
      wellFunctionAddress={wellFunctionAddress}
      pumpAddress={pumpAddress}
      token1={wellTokens.token1}
      token2={wellTokens.token2}
      wellName={wellDetails.name}
      wellSymbol={wellDetails.symbol}
    />
  );
};

type WellCreatePreviewInnerProps = {
  wellImplementation: string;
  pumpAddress: string;
  wellFunctionAddress: string;
  token1: ERC20Token;
  token2: ERC20Token;
  wellName: string;
  wellSymbol: string;
};
const WellCreatePreviewInner = ({
  wellImplementation,
  pumpAddress,
  wellFunctionAddress,
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
          {...getSelectedCardComponentProps(wellFunctionAddress, components.wellFunctions)}
        />
      </Flex>
      <Flex $gap={1}>
        <Text $variant="h3">Pumps</Text>
        <SelectedComponentCard {...getSelectedCardComponentProps(pumpAddress, components.pumps)} />
      </Flex>
    </Flex>
  );
};

// ----------------------------------------

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

// ----------------------------------------

// shared components
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

const Subtitle = styled(Text).attrs({ $mt: 0.5 })`
  color: ${theme.colors.stone};
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
