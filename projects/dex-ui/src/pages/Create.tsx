import React from "react";
import { CreateWellProvider, useCreateWell } from "src/components/Create/CreateWellProvider";
import { ChooseWellImplementation } from "src/components/Create/ChooseWellImplementation";

import { Page } from "src/components/Page";
import { ChooseFunctionAndPump } from "src/components/Create/ChooseFunctionAndPump";
import styled from "styled-components";

export type CreateWellStep = "well-implementation" | "function-pump" | "name-symbol" | "preview";

export const Create = () => {
  return (
    <CreateWellProvider>
      <Page>
        <ContentWrapper>
          <CreateSteps />
        </ContentWrapper>
      </Page>
    </CreateWellProvider>
  );
};

const CreateSteps = () => {
  const { step } = useCreateWell();

  return (
    <>
      <ChooseFunctionAndPump />
      {/* {step === 0 && <ChooseWellImplementation />} */}
      {/* {step === 1 && <ChooseFunctionAndPump />} */}
    </>
  );
};

const ContentWrapper = styled.div`
  display: flex;
  width: 100%;
  max-width: 1234px;
`;
