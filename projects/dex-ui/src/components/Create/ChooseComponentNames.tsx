import React, { useCallback, useMemo } from "react";
import { Divider, Flex } from "src/components/Layout";
import { Text } from "src/components/Typography";
import { theme } from "src/utils/ui/theme";
import styled from "styled-components";
import { CreateWellStepProps, useCreateWell } from "./CreateWellProvider";
import { FormProvider, useForm } from "react-hook-form";
import { CreateWellFormProgress } from "./shared/CreateWellFormProgress";
import { TextInputField } from "../Form";
import { useWells } from "src/wells/useWells";
import { CreateWellButtonRow } from "./shared/CreateWellButtonRow";
import { useWhitelistedWellComponents } from "./useWhitelistedWellComponents";

export type WellDetailsFormValues = CreateWellStepProps["step3"];

const useWellDetailsDefaultValues = () => {
  const components = useWhitelistedWellComponents();
  const { wellFunction = "", wellTokens } = useCreateWell();

  const token1 = wellTokens?.token1?.symbol;
  const token2 = wellTokens?.token2?.symbol;

  const whitelistedWellFunction = components.wellFunctions.find(
    (wf) => wf.address.toLowerCase() === wellFunction?.toLowerCase()
  );

  const componentName = whitelistedWellFunction?.component.name;
  const abbrev = whitelistedWellFunction?.component.tokenSuffixAbbreviation;

  const defaultName =
    componentName && token1 && token2 ? `${token1}:${token2} ${componentName}` : undefined;

  const defaultSymbol = abbrev && token1 && token2 && `${token1}${token2}${abbrev}`;

  return {
    name: defaultName,
    symbol: defaultSymbol
  };
};

const ChooseComponentNamesForm = () => {
  const { data: wells } = useWells();
  const { wellDetails, setStep3 } = useCreateWell();
  const defaults = useWellDetailsDefaultValues();

  const methods = useForm<WellDetailsFormValues>({
    defaultValues: {
      name: wellDetails?.name ?? defaults?.name ?? "",
      symbol: wellDetails?.symbol ?? defaults?.symbol ?? ""
    }
  });

  const validate = useMemo(() => {
    const wellName = (name: string) => {
      const duplicate = (wells || []).some(
        (well) => well.name?.toLowerCase() === name.toLowerCase()
      );

      return duplicate ? "Token name taken" : true;
    };

    const wellSymbol = (symbol: string) => {
      const duplicate = (wells || []).some(
        (well) => well?.lpToken?.symbol.toLowerCase() === symbol.toLowerCase()
      );
      return duplicate ? "Token symbol taken" : true;
    };

    return {
      name: wellName,
      symbol: wellSymbol
    };
  }, [wells]);

  const handleSave = useCallback(() => {
    const values = methods.getValues();
    setStep3(values);
  }, [setStep3, methods]);

  const onSubmit = useCallback(
    (values: WellDetailsFormValues) => {
      const nameValidated = validate.name(values.name);
      const symbolValidated = validate.symbol(values.symbol);

      if (typeof nameValidated === "string" || typeof symbolValidated === "string") {
        return;
      }

      setStep3({ ...values, goNext: true });
    },
    [setStep3, validate]
  );

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <Flex $direction="row" $gap={6}>
          <CreateWellFormProgress />
          <Flex $fullWidth $gap={4}>
            <div>
              <Text $variant="h3" $mb={2}>
                Name and Symbol
              </Text>
              <Flex $direction="row" $fullWidth $gap={4}>
                <Flex $width="50%" $maxWidth="50%">
                  <Text $variant="xs" $color="text.secondary" $mb={1}>
                    Well Token Name
                  </Text>
                  <TextInputField
                    {...methods.register("name", {
                      required: {
                        value: true,
                        message: "Token Name is required"
                      },
                      validate: (value) => validate.name(value)
                    })}
                  />
                </Flex>
                <Flex $width="50%" $maxWidth="50%">
                  <Text $variant="xs" $color="text.secondary" $mb={1}>
                    Well Token Symbol
                  </Text>
                  <TextInputField
                    {...methods.register("symbol", {
                      required: {
                        value: true,
                        message: "Token Symbol is required"
                      },
                      validate: (value) => validate.symbol(value)
                    })}
                  />
                </Flex>
              </Flex>
            </div>
            <Divider />
            <CreateWellButtonRow onGoBack={handleSave} />
          </Flex>
        </Flex>
      </form>
    </FormProvider>
  );
};

export const ChooseComponentNames = () => {
  return (
    <Flex $gap={3} $fullWidth>
      <div>
        <Text $variant="h2">Well Name and Symbol</Text>
        <Subtitle>Give your Well LP token a name and a symbol.</Subtitle>
      </div>
      <ChooseComponentNamesForm />
    </Flex>
  );
};

const Subtitle = styled(Text)`
  margin-top: ${theme.spacing(0.5)};
  color: ${theme.colors.stone};
`;
