import React, { createContext, useCallback, useState } from "react";
import {
  CONSTANT_PRODUCT_2_ADDRESS,
  MULTI_FLOW_PUMP_ADDRESS,
  WELL_DOT_SOL_ADDRESS
} from "src/utils/addresses";

type GoNextParams = {
  goNext?: boolean;
};

type SetWellImplementationStepParams = {
  wellImplementation: string;
};

type SetFunctionAndPumpStepParams = {
  wellFunction: string;
  token1: string;
  token2: string;
  pump: string;
};

type LiquidityParams = {
  seedingLiquidity: boolean;
  token1Amount?: string;
  token2Amount?: string;
};

type DeploySaltParams = {
  usingSalt: boolean;
  salt?: number;
};

export type CreateWellProps = {
  wellImplementation: SetWellImplementationStepParams;
  wellFunctionAndPump: SetFunctionAndPumpStepParams;
  wellNameAndSymbol: SetWellNameAndSymbolStepParams;
  liquidity: LiquidityParams;
  salt: DeploySaltParams;
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
  liquidity: LiquidityParams;
  salt: DeploySaltParams;
  goBack: () => void;
  goNext: () => void;
  setWellImplementation: (params: SetWellImplementationStepParams & GoNextParams) => void;
  setFunctionAndPump: (params: SetFunctionAndPumpStepParams & GoNextParams) => void;
  setWellNameAndSymbol: (params: SetWellNameAndSymbolStepParams) => void;
  setSalt: (params: DeploySaltParams) => void;
  setLiquidity: (params: LiquidityParams) => void;
  deployWell: () => Promise<any>;
};

const Context = createContext<CreateWellContext | null>(null);

export const CreateWellProvider = ({ children }: { children: React.ReactNode }) => {
  const [step, setStep] = useState<number>(3);

  /// step 1
  const [wellImplementation, setWellImplementation] = useState<
    SetWellImplementationStepParams | undefined
  >({ wellImplementation: WELL_DOT_SOL_ADDRESS.toLowerCase() });

  const [functionAndPump, setFunctionAndPump] = useState<SetFunctionAndPumpStepParams | undefined>({
    wellFunction: CONSTANT_PRODUCT_2_ADDRESS.toLowerCase(), // constantProduct2
    token1: "0x6B175474E89094C44Da98b954EedeAC495271d0F".toLowerCase(), // DAI
    token2: "0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab".toLowerCase(), // BEAN
    pump: MULTI_FLOW_PUMP_ADDRESS.toLowerCase() // multi flow pump
  });

  const [wellNameAndSymbol, setWellNameAndSymbol] = useState<
    SetWellNameAndSymbolStepParams | undefined
  >({ name: "Bean-DAI Well", symbol: "BEAN-DAI" });

  const [liquidity, setLiquidity] = useState<LiquidityParams>({
    seedingLiquidity: false
  });

  const [salt, setDeploySalt] = useState<DeploySaltParams>({
    usingSalt: false
  });

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

  const setWellNameAndSymbolStep: CreateWellContext["setWellNameAndSymbol"] = useCallback(
    (params) => {
      setWellNameAndSymbol(params);
    },
    []
  );

  const handleSetLiqiudityParams = useCallback((params: LiquidityParams) => {
    setLiquidity(params);
  }, []);

  const handleSetSaltParams = useCallback((params: DeploySaltParams) => {
    setDeploySalt(params);
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
        liquidity,
        salt,
        goBack: handleGoBack,
        goNext: handleGoNext,
        setLiquidity: handleSetLiqiudityParams,
        setSalt: handleSetSaltParams,
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
