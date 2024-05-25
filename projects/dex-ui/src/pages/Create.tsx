import React from "react";
import { CreateWellProvider, useCreateWell } from "src/components/Create/CreateWellProvider";
import { ChooseWellImplementation } from "src/components/Create/ChooseWellImplementation";

import { Page } from "src/components/Page";
import { ChooseFunctionAndPump } from "src/components/Create/ChooseFunctionAndPump";

export type CreateWellStep = "well-implementation" | "function-pump" | "name-symbol" | "preview";

export const Create = () => {
  const { step } = useCreateWell();

  return (
    <CreateWellProvider>
      <Page>
        <>
          {step === 0 && <ChooseWellImplementation />}
          {step === 1 && <ChooseFunctionAndPump />}
        </>
      </Page>
    </CreateWellProvider>
  );
};
