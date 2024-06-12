import React, { useEffect, useState } from "react";
import styled from "styled-components";
import {
  Control,
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  useWatch
} from "react-hook-form";
import { theme } from "src/utils/ui/theme";

import { StyledForm, SwitchField, TextInputField } from "src/components/Form";
import { Box, Divider, Flex, FlexCard } from "src/components/Layout";
import { SelectCard } from "src/components/Selectable";
import { Text } from "src/components/Typography";

import { CreateWellContext, CreateWellStepProps, useCreateWell } from "./CreateWellProvider";
import { WellComponentInfo, useWhitelistedWellComponents } from "./useWhitelistedWellComponents";

import { ERC20Token, TokenValue } from "@beanstalk/sdk";
import { TokenInput } from "src/components/Swap/TokenInput";
import { CreateWellButtonRow } from "./shared/CreateWellButtonRow";
import { useTokenAllowance } from "src/tokens/useTokenAllowance";
import useSdk from "src/utils/sdk/useSdk";
import { ButtonPrimary } from "../Button";
import { ensureAllowance } from "../Liquidity/allowance";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "src/utils/query/queryKeys";
import { useBoolean } from "src/utils/ui/useBoolean";
import { Dialog } from "../Dialog";
import { ProgressCircle } from "../ProgressCircle";
import { useNavigate } from "react-router-dom";

type FormValues = CreateWellStepProps["step4"] & {
  usingSalt: boolean;
  seedingLiquidity: boolean;
};

type FormContentProps = {
  salt: number | undefined;
  liquidity: CreateWellContext["liquidity"];
  token1: ERC20Token;
  token2: ERC20Token;
  deploying: boolean;
  setStep4: CreateWellContext["setStep4"];
  deployWell: CreateWellContext["deployWell"];
};

const FormContent = ({
  token1,
  token2,
  salt,
  liquidity,
  deploying,
  setStep4,
  deployWell
}: FormContentProps) => {
  const [enoughAllowance, setEnoughAllowance] = useState(true);
  const [modalOpen, { set: setModal }] = useBoolean(false);
  const [deployedWellAddress, setDeployedWellAddress] = useState<string>("");
  const [deployErr, setDeployErr] = useState<Error | undefined>();
  const navigate = useNavigate();

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
    setModal(true);
    setStep4({
      salt: values.usingSalt ? values.salt : undefined,
      token1Amount: values.token1Amount,
      token2Amount: values.token2Amount
    });

    const token1Amount = token1.fromHuman(Number(values.token1Amount || "0"));
    const token2Amount = token2.fromHuman(Number(values.token2Amount || "0"));

    // We determine that the user is seeding liquidity if they have 'seeding liquidity' toggled on in the CURRENT form
    // and if they have provided a non-zero amount for at least 1 token.
    const seedingLiquidity =
      values.seedingLiquidity && Boolean(token1Amount.gt(0) || token2Amount.gt(0));

    // Always use the salt value from the current form.
    const saltValue = (values.usingSalt && values.salt) || 0;

    const liquidity =
      seedingLiquidity && token1Amount && token2Amount ? { token1Amount, token2Amount } : undefined;

    const response = await deployWell(saltValue, liquidity);
    if ("wellAddress" in response) {
      setDeployedWellAddress(response.wellAddress);
      navigate(`/wells/${response.wellAddress}`);
    } else {
      setDeployErr(response);
    }
  };

  return (
    <>
      <FormProvider {...methods}>
        <StyledForm $width="100%" onSubmit={methods.handleSubmit(onSubmit)}>
          <Flex $gap={2}>
            <LiquidityForm
              token1={token1}
              token2={token2}
              setHasEnoughAllowance={setEnoughAllowance}
            />
            <SaltForm />
            <CreateWellButtonRow
              onGoBack={handleSave}
              valuesRequired={false}
              disabled={!enoughAllowance}
            />
          </Flex>
        </StyledForm>
      </FormProvider>
      <Dialog
        canClose={!deploying}
        open={modalOpen}
        closeModal={() => {
          setModal(false);
          setDeployErr(undefined);
        }}
      >
        <Flex $p={2} $alignItems="center">
          <Text $variant="l">Well Deployment In Progress</Text>
          <Flex $fullWidth>
            <Flex $my={5} $alignSelf="center">
              <ProgressCircle
                size={75}
                progress={80}
                strokeWidth={5}
                trackColor={theme.colors.white}
                strokeColor={theme.colors.primary}
                animate
                status={deployedWellAddress ? "success" : deployErr ? "error" : undefined}
              />
            </Flex>
            {deployErr ? (
              <Flex $alignSelf="flex-start">
                <Text>Transaction Reverted: </Text>
                <Text>{deployErr.message || "See console for details"}</Text>
              </Flex>
            ) : null}
          </Flex>
        </Flex>
      </Dialog>
    </>
  );
};

type LiquidityFormProps = {
  token1: ERC20Token;
  token2: ERC20Token;
  setHasEnoughAllowance: React.Dispatch<React.SetStateAction<boolean>>;
};
const LiquidityForm = ({ token1, token2, setHasEnoughAllowance }: LiquidityFormProps) => {
  const { control } = useFormContext<FormValues>();
  const seedingLiquidity = useWatch({ control, name: "seedingLiquidity" });

  return (
    <Flex $gap={2}>
      <Flex $direction="row" $gap={1} $alignItems="center">
        <SwitchField control={control} name="seedingLiquidity" />
        <Text $variant="xs" $weight="bold" $mb={-0.5}>
          Seed Well with initial liquidity
        </Text>
      </Flex>
      {seedingLiquidity && (
        <FlexCard $gap={3} $p={3} $boxSizing="border-box" $fullWidth $maxWidth="430px">
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
          <AllowanceButtons
            token1={token1}
            token2={token2}
            control={control}
            seedingLiquidity={seedingLiquidity}
            setHasEnoughAllowance={setHasEnoughAllowance}
          />
        </FlexCard>
      )}
    </Flex>
  );
};

const AllowanceButtons = ({
  token1,
  token2,
  control,
  seedingLiquidity,
  setHasEnoughAllowance
}: LiquidityFormProps & {
  control: Control<FormValues, any>;
  seedingLiquidity: boolean;
}) => {
  const { address } = useAccount();
  const sdk = useSdk();
  const queryClient = useQueryClient();

  const { data: token1Allowance } = useTokenAllowance(token1, sdk.contracts.beanstalk.address);
  const { data: token2Allowance } = useTokenAllowance(token2, sdk.contracts.beanstalk.address);

  const amount1 = useWatch({ control, name: "token1Amount" });
  const amount2 = useWatch({ control, name: "token2Amount" });

  const amount1ExceedsAllowance = token1Allowance && amount1 && token1Allowance.lt(Number(amount1));
  const amount2ExceedsAllowance = token2Allowance && amount2 && token2Allowance.lt(Number(amount2));

  const approveToken = async (token: ERC20Token, amount: TokenValue) => {
    if (!address) return;
    await ensureAllowance(address, sdk.contracts.beanstalk.address, token, amount);
    queryClient.fetchQuery({
      queryKey: queryKeys.tokenAllowance(token.address, sdk.contracts.beanstalk.address)
    });
  };

  useEffect(() => {
    if (seedingLiquidity && (amount1ExceedsAllowance || amount2ExceedsAllowance)) {
      setHasEnoughAllowance(false);
      return;
    }

    setHasEnoughAllowance(true);
  }, [amount1ExceedsAllowance, seedingLiquidity, amount2ExceedsAllowance, setHasEnoughAllowance]);

  if (!amount1ExceedsAllowance && !amount2ExceedsAllowance) {
    return null;
  }

  return (
    <Flex $direction="row" $gap={2}>
      {amount1ExceedsAllowance && (
        <ButtonPrimary
          $fullWidth
          onClick={(e) => {
            // prevent form submission
            e.preventDefault();
            e.stopPropagation();
            approveToken(token1, token1.amount(amount1));
          }}
        >
          Approve {token1.symbol}
        </ButtonPrimary>
      )}
      {amount2ExceedsAllowance && (
        <ButtonPrimary
          $fullWidth
          onClick={(e) => {
            // prevent form submission
            e.preventDefault();
            e.stopPropagation();
            approveToken(token2, token2.amount(amount2));
          }}
        >
          Approve {token2.symbol}
        </ButtonPrimary>
      )}
    </Flex>
  );
};

const useSeedingLiquidity = () => {
  const { control, setValue } = useFormContext<FormValues>();

  const seedingLiquidity = useWatch({ control, name: "seedingLiquidity" });
  const amount1 = useWatch({ control, name: "token1Amount" });
  const amount2 = useWatch({ control, name: "token2Amount" });
  const salt = useWatch({ control, name: "salt" });

  const noAmounts = !amount1 && !amount2;
  const noSaltValue = !salt;

  const isSeedingLiquidityAndHasValues = seedingLiquidity && !noAmounts;

  // Conditionally toggle 'usingSalt' field based on seeding liquidity and salt values
  useEffect(() => {
    if (seedingLiquidity) {
      setValue("usingSalt", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedingLiquidity]);

  useEffect(() => {
    if (!seedingLiquidity && noSaltValue && noAmounts) {
      setValue("usingSalt", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noSaltValue, seedingLiquidity, noAmounts]);

  return {
    isSeedingLiquidityAndHasValues,
    seedingLiquidityToggled: seedingLiquidity
  } as const;
};

const SaltForm = () => {
  const {
    control,
    register,
    formState: {
      errors: { salt: saltError }
    }
  } = useFormContext<FormValues>();
  const usingSalt = useWatch({ control, name: "usingSalt" });
  const { isSeedingLiquidityAndHasValues, seedingLiquidityToggled } = useSeedingLiquidity();

  return (
    <Flex $gap={2}>
      <Flex $gap={1}>
        <Flex $direction="row" $gap={1} $alignItems="center">
          <SwitchField
            control={control}
            name="usingSalt"
            // disable the user from toggling the field if seeding liquidity is toggled
            disabled={seedingLiquidityToggled}
          />
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
              value: isSeedingLiquidityAndHasValues ? true : false,
              message: "Salt is required when seeding liquidity"
            },
            min: {
              value: isSeedingLiquidityAndHasValues ? 1 : 0,
              message: "Salt must be >= 1 when seeding liquidity"
            },
            validate: (formValue) => {
              console.log("formValue: ", formValue);
              if (formValue && !Number.isInteger(Number(formValue))) {
                return "Salt must be an integer";
              }
              return true;
            }
          })}
          error={saltError?.message as string | undefined}
        />
      )}
    </Flex>
  );
};

// ----------------------------------------

export const CreateWellStep4 = () => {
  const { components } = useWhitelistedWellComponents();
  const {
    wellImplementation,
    pumpAddress,
    wellFunctionAddress,
    wellTokens: { token1, token2 },
    wellDetails: { name: wellName, symbol: wellSymbol },
    salt,
    liquidity,
    loading,
    setStep4,
    deployWell
  } = useCreateWell();

  if (
    !wellImplementation ||
    !pumpAddress ||
    !wellFunctionAddress ||
    !token1 ||
    !token2 ||
    !wellName ||
    !wellSymbol
  ) {
    return null;
  }

  return (
    <Flex $fullWidth>
      <div>
        <Text $variant="h2">Preview Deployment</Text>
        <Subtitle>Review selections and deploy your Well.</Subtitle>
      </div>
      <Flex $mt={3}>
        <Flex $gap={4}>
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
              <img src={token1.logo ?? ""} alt={token1.name ?? ""} />
              <Text $variant="l">{token1?.symbol ?? ""}</Text>
            </InlineImgFlex>
            <InlineImgFlex>
              <img src={token2.logo ?? ""} alt={token2.name ?? ""} />
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
            <SelectedComponentCard
              {...getSelectedCardComponentProps(pumpAddress, components.pumps)}
            />
          </Flex>
        </Flex>
      </Flex>
      <Box $my={4}>
        <Divider />
      </Box>
      <FormContent
        salt={salt}
        liquidity={liquidity}
        token1={token1}
        token2={token2}
        deploying={loading}
        setStep4={setStep4}
        deployWell={deployWell}
      />
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
