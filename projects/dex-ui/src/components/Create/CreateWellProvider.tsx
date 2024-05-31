import { ERC20Token } from "@beanstalk/sdk-core";
import React, { createContext, useCallback, useMemo, useState } from "react";
import { WELL_DOT_SOL_ADDRESS } from "src/utils/addresses";

type GoNextParams = {
  goNext?: boolean;
};

type SetWellImplementationStepParams = {
  wellImplementation: string;
};

type SetFunctionAndPumpStepParams = {
  wellFunction: string;
  token1Address: string;
  token2Address: string;
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

export type CreateWellContext = {
  step: number;
  wellImplementation: SetWellImplementationStepParams | undefined;
  functionAndPump: SetFunctionAndPumpStepParams | undefined;
  wellNameAndSymbol: SetWellNameAndSymbolStepParams | undefined;
  liquidity: LiquidityParams;
  salt: DeploySaltParams;
  tokens: { token1?: ERC20Token; token2?: ERC20Token };
  goBack: () => void;
  goNext: () => void;
  setWellImplementation: (params: SetWellImplementationStepParams & GoNextParams) => void;
  setFunctionAndPump: (params: SetFunctionAndPumpStepParams & GoNextParams) => void;
  setWellNameAndSymbol: (params: SetWellNameAndSymbolStepParams & GoNextParams) => void;
  setSalt: (params: DeploySaltParams) => void;
  setLiquidity: (params: LiquidityParams) => void;
  deployWell: () => Promise<any>;
  setTokens: (tokens: { token1: ERC20Token; token2: ERC20Token }) => void;
};

const Context = createContext<CreateWellContext | null>(null);

export const CreateWellProvider = ({ children }: { children: React.ReactNode }) => {
  const [step, setStep] = useState<number>(0);

  /// step 1
  const [wellImplementation, setWellImplementation] = useState<
    SetWellImplementationStepParams | undefined
  >({ wellImplementation: WELL_DOT_SOL_ADDRESS.toLowerCase() });

  const [functionAndPump, setFunctionAndPump] = useState<SetFunctionAndPumpStepParams | undefined>({
    wellFunction: "",
    token1Address: "",
    token2Address: "",
    pump: ""
  });

  const [tokens, setTokens] = useState<{
    token1?: ERC20Token;
    token2?: ERC20Token;
  }>({});

  const [wellNameAndSymbol, setWellNameAndSymbol] = useState<
    SetWellNameAndSymbolStepParams | undefined
  >({ name: "Bean-DAI Well", symbol: "BEAN-DAI" });

  const [liquidity, setLiquidity] = useState<LiquidityParams>({
    seedingLiquidity: false
  });

  const [salt, setDeploySalt] = useState<DeploySaltParams>({
    usingSalt: false
  });

  const methods = useMemo(() => {
    const handleSetLiquidity = (params: LiquidityParams) => setLiquidity(params);
    const handleSetSalt = (params: DeploySaltParams) => setDeploySalt(params);
    const handleSetTokens = (params: { token1: ERC20Token; token2: ERC20Token }) => {
      setTokens(params);
    };
    const handleGoNext = () => {
      setStep((_step) => Math.min(_step + 1, 3));
    };
    const handleGoBack = () => {
      setStep((_step) => Math.min(_step - 1, 0));
    };

    return {
      setLiquidity: handleSetLiquidity,
      setSalt: handleSetSalt,
      setTokens: handleSetTokens,
      goNext: handleGoNext,
      goBack: handleGoBack
    };
  }, []);

  const setWellImplementationStep: CreateWellContext["setWellImplementation"] = useCallback(
    ({ goNext, ...params }) => {
      setWellImplementation(params);
      if (goNext) {
        methods.goNext();
      }
    },
    [methods]
  );

  const setFunctionAndPumpStep: CreateWellContext["setFunctionAndPump"] = useCallback(
    ({ goNext, ...params }) => {
      setFunctionAndPump(params);
      if (goNext) {
        methods.goNext();
      }
    },
    [methods]
  );

  const setWellNameAndSymbolStep: CreateWellContext["setWellNameAndSymbol"] = useCallback(
    ({ goNext, ...params }) => {
      setWellNameAndSymbol(params);
      if (goNext) {
        methods.goNext();
      }
    },
    [methods]
  );

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
        tokens: tokens,
        setWellImplementation: setWellImplementationStep,
        setFunctionAndPump: setFunctionAndPumpStep,
        setWellNameAndSymbol: setWellNameAndSymbolStep,
        deployWell,
        ...methods
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
