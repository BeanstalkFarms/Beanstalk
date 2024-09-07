import React from "react";

import {
  CreateWellStep1,
  CreateWellStep2,
  CreateWellStep3,
  CreateWellStep4,
  CreateWellProvider,
  useCreateWell
} from "src/components/Create";
import { Flex } from "src/components/Layout";
import { Page } from "src/components/Page";

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
          <CreateWellStep1 />
        </Flex>
      )}
      {step === 1 && (
        <Flex $fullWidth $maxWidth={CONTENT_MAX_WIDTH}>
          <CreateWellStep2 />
        </Flex>
      )}
      {step === 2 && (
        <Flex $fullWidth $maxWidth={CONTENT_MAX_WIDTH}>
          <CreateWellStep3 />
        </Flex>
      )}
      {step === 3 && (
        <Flex $fullWidth $alignSelf="center" $maxWidth={PREVIEW_MAX_WIDTH}>
          <CreateWellStep4 />
        </Flex>
      )}
    </>
  );
};

const CONTENT_MAX_WIDTH = "1234px";
const PREVIEW_MAX_WIDTH = "710px";
