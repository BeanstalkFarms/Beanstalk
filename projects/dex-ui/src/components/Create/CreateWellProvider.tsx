import React, { createContext, useCallback, useState } from "react";

type GoNextParams = {
  goNext?: boolean;
};

type SetWellImplementationStepParams = {
  wellImplementation: string;
};

type SetFunctionAndPumpStepParams = {
  wellFunction: string;
  token1: {
    type: string;
    address: string;
  };
  token2: {
    type: string;
    address: string;
  };
  pump: string;
};

export type CreateWellProps = {
  wellImplementation: SetWellImplementationStepParams;
  wellFunctionAndPump: SetFunctionAndPumpStepParams;
  wellNameAndSymbol: SetWellNameAndSymbolStepParams;
};

type SetWellNameAndSymbolStepParams = {
  name: string;
  symbol: string;
};

type CreateWellContext = {
  step: number;
  wellImplementation: SetWellImplementationStepParams | undefined;
  functionAndPump: SetFunctionAndPumpStepParams | undefined;
  wellNameAndSymbol: SetWellNameAndSymbolStepParams | undefined;
  goBack: () => void;
  goNext: () => void;
  setWellImplementation: (params: SetWellImplementationStepParams & GoNextParams) => void;
  setFunctionAndPump: (params: SetFunctionAndPumpStepParams & GoNextParams) => void;
  setWellNameAndSymbol: (params: SetWellNameAndSymbolStepParams) => void;
  deployWell: () => Promise<any>;
};

const Context = createContext<CreateWellContext | null>(null);

export const CreateWellProvider = ({ children }: { children: React.ReactNode }) => {
  const [step, setStep] = useState<number>(0);

  /// step 1
  const [wellImplementation, setWellImplementation] = useState<SetWellImplementationStepParams | undefined>();
  const [functionAndPump, setFunctionAndPump] = useState<SetFunctionAndPumpStepParams | undefined>();
  const [wellNameAndSymbol, setWellNameAndSymbol] = useState<SetWellNameAndSymbolStepParams | undefined>();

  const handleGoNext = useCallback(() => {
    setStep((_step) => Math.min(_step + 1, 3));
  }, []);

  const handleGoBack = useCallback(() => {
    setStep((_step) => Math.min(_step - 1, 0));
  }, []);

  const setWellImplementationStep: CreateWellContext["setWellImplementation"] = useCallback(
    ({ goNext, ...params }) => {
      setWellImplementation(params);
      if (goNext) {
        handleGoNext();
      }
    },
    [handleGoNext]
  );

  const setFunctionAndPumpStep: CreateWellContext["setFunctionAndPump"] = useCallback(
    ({ goNext, ...params }) => {
      setFunctionAndPump(params);
      if (goNext) {
        handleGoNext();
      }
    },
    [handleGoNext]
  );

  const setWellNameAndSymbolStep: CreateWellContext["setWellNameAndSymbol"] = useCallback((params) => {
    setWellNameAndSymbol(params);
  }, []);

  const deployWell = useCallback(async () => {
    console.debug({
      wellImplementation,
      functionAndPump,
      wellNameAndSymbol
    });
  }, [wellImplementation, functionAndPump, wellNameAndSymbol]);

  return (
    <Context.Provider
      value={{
        step,
        wellImplementation,
        functionAndPump,
        wellNameAndSymbol,
        goBack: handleGoBack,
        goNext: handleGoNext,
        setWellImplementation: setWellImplementationStep,
        setFunctionAndPump: setFunctionAndPumpStep,
        setWellNameAndSymbol: setWellNameAndSymbolStep,
        deployWell
      }}
    >
      {children}
    </Context.Provider>
  );
};

export const useCreateWell = () => {
  const context = React.useContext(Context);

  if (!context) {
    throw new Error("useCreateWell must be used within a CreateWellProvider");
  }

  return context;
};
