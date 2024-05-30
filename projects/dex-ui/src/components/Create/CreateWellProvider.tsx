import { ERC20Token } from "@beanstalk/sdk-core";
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
    wellFunction: CONSTANT_PRODUCT_2_ADDRESS.toLowerCase(), // constantProduct2
    // token1: "0x6B175474E89094C44Da98b954EedeAC495271d0F".toLowerCase(), // DAI
    token1Address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9".toLowerCase(), // AAVE
    // token1: "0xb01CE0008CaD90104651d6A84b6B11e182a9B62A".toLowerCase(), // Beanstalk
    // token1: "0xBA510e11eEb387fad877812108a3406CA3f43a4B".toLowerCase(), // well.sol
    token2Address: "0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab".toLowerCase(), // BEAN
    pump: MULTI_FLOW_PUMP_ADDRESS.toLowerCase() // multi flow pump
  });

  const [tokens, setTokens] = useState<{
    token1: ERC20Token | undefined;
    token2: ERC20Token | undefined;
  }>({ token1: undefined, token2: undefined });

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
    ({ goNext, ...params }) => {
      setWellNameAndSymbol(params);
      if (goNext) {
        handleGoNext();
      }
    },
    [handleGoNext]
  );

  const handleSetLiqiudityParams = useCallback((params: LiquidityParams) => {
    setLiquidity(params);
  }, []);

  const handleSetSaltParams = useCallback((params: DeploySaltParams) => {
    setDeploySalt(params);
  }, []);

  const handleSetERC20Tokens = useCallback((params: { token1: ERC20Token; token2: ERC20Token }) => {
    setTokens(params);
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
        tokens: tokens,
        goBack: handleGoBack,
        goNext: handleGoNext,
        setLiquidity: handleSetLiqiudityParams,
        setSalt: handleSetSaltParams,
        setWellImplementation: setWellImplementationStep,
        setFunctionAndPump: setFunctionAndPumpStep,
        setWellNameAndSymbol: setWellNameAndSymbolStep,
        setTokens: handleSetERC20Tokens,
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
