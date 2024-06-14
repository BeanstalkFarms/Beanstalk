import React, { createContext, useCallback, useMemo, useState } from "react";
import { ERC20Token, TokenValue } from "@beanstalk/sdk-core";
import { DeepRequired } from "react-hook-form";
import useSdk from "src/utils/sdk/useSdk";
import { Log } from "src/utils/logger";
import { Pump, WellFunction } from "@beanstalk/sdk-wells";
import { useAccount } from "wagmi";
import { usePumps } from "src/wells/pump/usePumps";
import { useWellFunctions } from "src/wells/wellFunction/useWellFunctions";
import BoreWellUtils from "src/wells/boreWell";
import { clearWellsCache } from "src/wells/useWells";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Architecture notes: @Space-Bean
 *
 * This create well flow consists of 4 pages.
 * 1. Select the well implementation
 * 2. Select the well function, tokens, and pump
 * 3. Enter the well name and symbol
 * 4. Enter the liquidity amounts, salt, and deploy.
 *
 *
 * Well Functions:
 * - Every well function is optionally deployed with a 'data' parameter. It is important to note that if we initialize a WellFunction object
 *   w/ the incorrect 'data' value, any calls to the well function will be nonsensical. We utilize this 'data' value to determine the
 *   LP token supply the user will recieve when they seed liquidity.
 * - In the case where the user decides to use their own well function, since we cannot know the value of 'data', we rely on the user
 *   to accurately provide the 'data' value.
 * - In the case where it is a well function that is already deployed & is in use via other wells, we can safely fetch this data via Well.well().
 *
 * Pumps:
 * - Pumps are similar to well functions in that they are optionally deployed with a 'data' parameter.
 *
 * Deploying:
 * - The user can choose to deploy a well with or without liquidity.
 *  - In the case where the user decides to deploy w/o seeding liquidity, we can deploy the well via interfacing with the contract directly.
 *  - If the user decides to deploy with liquidity, we must use the pipeline contract to deploy the well.
 *    Because we we must be able to detministically predict the well address to add subsequently add liquidity, we must provide a valid 'salt' value.
 *    Aquifer.sol only creates a copy of a well implementation at a deterministic address if the 'salt' value is greater than 0.
 *
 * Vulnerabilities:
 * - If the user provides the wrong 'data' value for a well function or a pump, the well may not deploy, may never function properly, or this may result in loss of funds.
 */

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
  wellFunctionAddress: string | undefined;
  wellFunctionData: string | undefined;
  wellFunction: WellFunction | undefined;
  pumpAddress: string | undefined;
  pumpData: string | undefined;
  wellDetails: Partial<WellDetails>;
  wellTokens: Partial<WellTokensParams>;
  liquidity: Partial<LiquidityAmounts>;
  salt: number | undefined;
  loading: boolean;
  goBack: () => void;
  goNext: () => void;
  setStep1: (params: Partial<{ wellImplementation: string } & GoNextParams>) => void;
  setStep2: (
    params: Partial<
      {
        wellFunctionAddress: string;
        wellFunctionData: string;
        token1: ERC20Token;
        token2: ERC20Token;
        pumpAddress: string;
        pumpData: string;
        wellFunction: WellFunction;
      } & GoNextParams
    > & {}
  ) => void;
  setStep3: (params: Partial<WellDetails & GoNextParams>) => void;
  setStep4: (params: Partial<LiquidityAmounts & { salt?: number }>) => void;
  deployWell: (
    saltValue: number,
    liquidity?: {
      token1Amount: TokenValue;
      token2Amount: TokenValue;
    }
  ) => Promise<{ wellAddress: string } | Error>;
};

export type CreateWellStepProps = DeepRequired<{
  step1: {
    wellImplementation: CreateWellContext["wellImplementation"];
  };
  step2: {
    wellFunctionAddress: CreateWellContext["wellFunctionAddress"];
    pumpAddress: CreateWellContext["pumpAddress"];
    wellTokens: CreateWellContext["wellTokens"];
    pumpData: CreateWellContext["pumpData"];
    wellFunctionData: CreateWellContext["wellFunctionData"];
  };
  step3: CreateWellContext["wellDetails"];
  step4: CreateWellContext["liquidity"] & {
    salt: CreateWellContext["salt"];
  };
}>;

const Context = createContext<CreateWellContext | null>(null);

export const CreateWellProvider = ({ children }: { children: React.ReactNode }) => {
  const { address: walletAddress } = useAccount();
  const sdk = useSdk();
  // const wellFunctions = useWellFunctions();
  const pumps = usePumps();
  const queryClient = useQueryClient();

  /// ----- Local State -----
  const [deploying, setDeploying] = useState(false);
  const [step, setStep] = useState<number>(0);

  // step 1
  const [wellImplementation, setWellImplementation] = useState<string | undefined>();

  // step 2
  const [pumpAddress, setPumpAddress] = useState<string | undefined>();
  const [pumpData, setPumpData] = useState<string | undefined>();
  const [wellFunction, setWellFunction] = useState<WellFunction | undefined>();
  const [wellFunctionAddress, setWellFunctionAddress] = useState<string | undefined>();
  const [wellFunctionData, setWellFunctionData] = useState<string | undefined>();
  const [wellTokens, setWellTokens] = useState<Partial<WellTokensParams>>({});

  // step 3
  const [wellDetails, setWellDetails] = useState<Partial<WellDetails>>({});

  // step 4
  const [liquidity, setLiquidity] = useState<Partial<LiquidityAmounts>>({});
  const [salt, setDeploySalt] = useState<number | undefined>();

  /// ------- State Methods -----
  const methods = useMemo(() => {
    const handleSetLiquidity = (params: LiquidityAmounts) => setLiquidity(params);
    const handleSetSalt = (_salt: number) => setDeploySalt(_salt);
    const handleGoNext = () => {
      setStep((_step) => Math.min(_step + 1, 3));
    };
    const handleGoBack = () => {
      setStep((_step) => Math.max(_step - 1, 0));
    };
    const handleSetPump = (pump: string) => setPumpAddress(pump);
    const handleSetWellFunction = (wellFunction: string) => setWellFunctionAddress(wellFunction);
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
      setPumpAddress(params.pumpAddress);
      setWellFunctionAddress(params.wellFunctionAddress);
      setWellTokens({
        token1: params.token1,
        token2: params.token2
      });
      setWellFunctionData(params.wellFunctionData);
      setPumpData(params.pumpData);
      setWellFunction(params.wellFunction);
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

  /// ----- Derived State -----

  const pump = useMemo(() => {
    if (!pumpAddress || pumpAddress.toLowerCase() === "none") return;
    const existing = pumps.find((p) => p.address.toLowerCase() === pumpAddress.toLowerCase());
    if (existing) return existing;

    return pumpData ? new Pump(sdk.wells, pumpAddress, pumpData) : undefined;
  }, [sdk.wells, pumps, pumpAddress, pumpData]);

  /// ----- Callbacks -----
  const deployWell: CreateWellContext["deployWell"] = useCallback(
    async (saltValue, liquidityAmounts) => {
      setDeploying(true);
      Log.module("wellDeployer").debug("Deploying Well...");

      try {
        if (!walletAddress) throw new Error("Wallet not connected");
        if (!wellImplementation) throw new Error("well implementation not set");
        if (!wellFunction) throw new Error("Well function not set");
        if (!wellTokens.token1) throw new Error("token 1 not set");
        if (!wellTokens.token2) throw new Error("token 2 not set");
        if (!wellDetails.name) throw new Error("well name not set");
        if (!wellDetails.symbol) throw new Error("well symbol not set");
        if (pumpAddress && !pump) {
          throw new Error("pump not set");
        }

        const { wellAddress } = await BoreWellUtils.boreWell(
          sdk,
          walletAddress,
          wellImplementation,
          wellFunction,
          pump ? [pump] : [],
          wellTokens.token1,
          wellTokens.token2,
          wellDetails.name,
          wellDetails.symbol,
          saltValue,
          liquidityAmounts
        );

        clearWellsCache();
        queryClient.fetchQuery({ queryKey: ["wells", sdk] });

        Log.module("wellDeployer").debug("Well deployed at address: ", wellAddress || "");
        setDeploying(false);
        return { wellAddress: wellAddress };
      } catch (e: any) {
        setDeploying(false);
        console.error(e);
        return e;
      }
    },
    [
      pumpAddress,
      queryClient,
      walletAddress,
      wellImplementation,
      wellFunction,
      pump,
      wellTokens.token1,
      wellTokens.token2,
      wellDetails.name,
      wellDetails.symbol,
      sdk
    ]
  );

  return (
    <Context.Provider
      value={{
        step,
        wellImplementation,
        wellFunction,
        wellFunctionAddress,
        wellFunctionData,
        pumpAddress,
        pumpData,
        wellDetails,
        wellTokens,
        liquidity,
        salt,
        loading: deploying,
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
