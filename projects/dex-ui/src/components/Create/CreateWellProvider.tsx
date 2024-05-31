import React, { createContext, useCallback, useMemo, useState } from "react";
import { ERC20Token } from "@beanstalk/sdk-core";

type GoNextParams = {
  goNext?: boolean;
};

type WellTokensParams = {
  token1: ERC20Token;
  token2: ERC20Token;
};

type LiquidityAmounts = {
  token1Amount: string;
  token2Amount: string;
};

type WellDetails = {
  name: string;
  symbol: string;
};

export type CreateWellContext = {
  step: number;
  wellImplementation: string | undefined;
  wellFunction: string | undefined;
  pump: string | undefined;
  wellDetails: Partial<WellDetails>;
  wellTokens: Partial<WellTokensParams>;
  liquidity: Partial<LiquidityAmounts>;
  salt: number | undefined;
  goBack: () => void;
  goNext: () => void;
  setStep1: (params: { wellImplementation: string } & GoNextParams) => void;
  setStep2: (
    params: {
      wellFunction: string;
      token1: ERC20Token;
      token2: ERC20Token;
      pump: string;
    } & GoNextParams
  ) => void;
  setStep3: (params: WellDetails & GoNextParams) => void;
  setStep4: (params: LiquidityAmounts & { salt?: number }) => void;
  deployWell: () => Promise<any>;
};

export type CreateWellStepProps = {
  step1: {
    wellImplementation: CreateWellContext["wellImplementation"];
  };
  step2: {
    wellFunction: CreateWellContext["wellFunction"];
    pump: CreateWellContext["pump"];
    wellTokens: CreateWellContext["wellTokens"];
  };
  step3: CreateWellContext["wellDetails"];
  step4: CreateWellContext["liquidity"] & {
    salt: CreateWellContext["salt"];
  };
};

const Context = createContext<CreateWellContext | null>(null);

export const CreateWellProvider = ({ children }: { children: React.ReactNode }) => {
  const [step, setStep] = useState<number>(0);

  // step 1
  const [wellImplementation, setWellImplementation] = useState<string | undefined>();

  // step 2
  const [pump, setPump] = useState<string | undefined>();
  const [wellFunction, setWellFunction] = useState<string | undefined>();
  const [wellTokens, setWellTokens] = useState<Partial<WellTokensParams>>({});

  // step 3
  const [wellDetails, setWellDetails] = useState<Partial<WellDetails>>({});

  // step 4
  const [liquidity, setLiquidity] = useState<Partial<LiquidityAmounts>>({});
  const [salt, setDeploySalt] = useState<number | undefined>();

  const methods = useMemo(() => {
    const handleSetLiquidity = (params: LiquidityAmounts) => setLiquidity(params);
    const handleSetSalt = (_salt: number) => setDeploySalt(_salt);
    const handleGoNext = () => {
      setStep((_step) => Math.min(_step + 1, 3));
    };
    const handleGoBack = () => {
      setStep((_step) => Math.min(_step - 1, 0));
    };
    const handleSetPump = (pump: string) => setPump(pump);
    const handleSetWellFunction = (wellFunction: string) => setWellFunction(wellFunction);
    const handleSetWellDetails = (details: WellDetails) => setWellDetails(details);

    return {
      setLiquidity: handleSetLiquidity,
      setSalt: handleSetSalt,
      goNext: handleGoNext,
      goBack: handleGoBack,
      setPump: handleSetPump,
      setWellFunction: handleSetWellFunction,
      setWellDetails: handleSetWellDetails
    };
  }, []);

  const setStep1: CreateWellContext["setStep1"] = useCallback(
    (params) => {
      setWellImplementation(params.wellImplementation);
      params.goNext && methods.goNext();
    },
    [methods]
  );

  const setStep2: CreateWellContext["setStep2"] = useCallback(
    (params) => {
      setPump(params.pump);
      setWellFunction(params.wellFunction);
      setWellTokens({
        token1: params.token1,
        token2: params.token2
      });

      params.goNext && methods.goNext();
    },
    [methods]
  );

  const setStep3: CreateWellContext["setStep3"] = useCallback(
    ({ goNext, ...params }) => {
      setWellDetails(params);
      goNext && methods.goNext();
    },
    [methods]
  );

  const setStep4: CreateWellContext["setStep4"] = useCallback((params) => {
    setDeploySalt(params.salt);
    setLiquidity({
      token1Amount: params.token1Amount,
      token2Amount: params.token2Amount
    });
  }, []);

  const deployWell = useCallback(async () => {
    console.log("deploying well...");
  }, []);

  return (
    <Context.Provider
      value={{
        step,
        wellImplementation,
        wellFunction,
        pump,
        wellDetails,
        wellTokens,
        liquidity,
        salt,
        setStep1,
        setStep2,
        setStep3,
        setStep4,
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
