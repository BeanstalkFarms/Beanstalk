import React from "react";
import { CreateWellProvider, useCreateWell } from "src/components/Create/CreateWellProvider";
import { ChooseWellImplementation } from "src/components/Create/ChooseWellImplementation";

import { Page } from "src/components/Page";
import { ChooseFunctionAndPump } from "src/components/Create/ChooseFunctionAndPump";
import { ChooseComponentNames } from "src/components/Create/ChooseComponentNames";
import { CreateWellPreviewDeploy } from "src/components/Create/CreateWellPreviewDeploy";
import { Flex } from "src/components/Layout";

export type CreateWellStep = "well-implementation" | "function-pump" | "name-symbol" | "preview";

export const Create = () => {
  return (
    <CreateWellProvider>
      <Page>
        <CreateSteps />
      </Page>
    </CreateWellProvider>
  );
};

const CreateSteps = () => {
  const { step } = useCreateWell();

  return (
    <>
      {step === 0 && (
        <Flex $fullWidth $maxWidth={CONTENT_MAX_WIDTH}>
          <ChooseWellImplementation />
        </Flex>
      )}
      {step === 1 && (
        <Flex $fullWidth $maxWidth={CONTENT_MAX_WIDTH}>
          <ChooseFunctionAndPump />
        </Flex>
      )}
      {step === 2 && (
        <Flex $fullWidth $maxWidth={CONTENT_MAX_WIDTH}>
          <ChooseComponentNames />
        </Flex>
      )}
      {step === 3 && (
        <Flex $fullWidth $alignSelf="center" $maxWidth={PREVIEW_MAX_WIDTH}>
          <CreateWellPreviewDeploy />
        </Flex>
      )}
    </>
  );
};

const CONTENT_MAX_WIDTH = "1234px";
const PREVIEW_MAX_WIDTH = "710px";