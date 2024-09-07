import React from "react";

import { createStore, Provider } from "jotai";

import { aquiferAtom, wellsAtom, sdkAtom } from "./atoms";
import AquiferProvider from "./providers/AquiverProvider";
import { SdkProvider } from "./providers/SdkProvider";
import WellsProvider from "./providers/WellsProvider";

const jotaiStore = createStore();
jotaiStore.set(sdkAtom, null);
jotaiStore.set(aquiferAtom, null);
jotaiStore.set(wellsAtom, { data: [], error: null, isLoading: false });

const JotaiProvider = React.memo(({ children }: { children: React.ReactNode }) => {
  return (
    <Provider store={jotaiStore}>
      <SdkProvider>
        <AquiferProvider>
          <WellsProvider>{children}</WellsProvider>
        </AquiferProvider>
      </SdkProvider>
    </Provider>
  );
});

export default JotaiProvider;
