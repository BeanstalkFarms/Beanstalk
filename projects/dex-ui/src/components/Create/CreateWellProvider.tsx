import React, { createContext, useCallback, useMemo, useState } from "react";
import { ERC20Token, TokenValue } from "@beanstalk/sdk-core";
import { DeepRequired } from "react-hook-form";
import useSdk from "src/utils/sdk/useSdk";
import { TransactionToast } from "../TxnToast/TransactionToast";
import { Log } from "src/utils/logger";
import { Aquifer, Pump, Well, WellFunction } from "@beanstalk/sdk-wells";
import { useAccount } from "wagmi";
import { FarmFromMode, FarmToMode } from "@beanstalk/sdk";
import { ContractTransaction, ethers, BigNumber } from "ethers";
import { usePumps } from "src/wells/pump/usePumps";
import { useWellFunctions } from "src/wells/wellFunction/useWellFunctions";
import BoreWellUtils from "src/wells/boreWell";
import { Settings } from "src/settings";
import { makeLocalOnlyStep } from "src/utils/workflow/steps";

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

const { prepareBoreWellParameters, decodeBoreWellPipeCall } = BoreWellUtils;

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
        wellFunction: string;
        wellFunctionData: string;
        token1: ERC20Token;
        token2: ERC20Token;
        pump: string;
        pumpData: string;
      } & GoNextParams
    >
  ) => void;
  setStep3: (params: Partial<WellDetails & GoNextParams>) => void;
  setStep4: (params: Partial<LiquidityAmounts & { salt?: number }>) => void;
  deployWell: (
    saltValue: number,
    liquidity?: {
      token1Amount: TokenValue;
      token2Amount: TokenValue;
    }
  ) => Promise<any>;
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
  const wellFunctions = useWellFunctions();
  const pumps = usePumps();

  /// ----- Local State -----
  const [deploying, setDeploying] = useState(false);
  const [step, setStep] = useState<number>(0);

  // step 1
  const [wellImplementation, setWellImplementation] = useState<string | undefined>();

  // step 2
  const [pumpAddress, setPumpAddress] = useState<string | undefined>();
  const [pumpData, setPumpData] = useState<string | undefined>();
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
      setPumpAddress(params.pump);
      setWellFunctionAddress(params.wellFunction);
      setWellTokens({
        token1: params.token1,
        token2: params.token2
      });
      setWellFunctionData(params.wellFunctionData);
      setPumpData(params.pumpData);
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
  const wellFunction = useMemo(() => {
    if (!wellFunctionAddress) return;
    const existing = wellFunctions.find(
      (wf) => wf.address.toLowerCase() === wellFunctionAddress.toLowerCase()
    );
    if (existing) return existing;

    return wellFunctionData
      ? new WellFunction(sdk.wells, wellFunctionAddress, wellFunctionData)
      : undefined;
  }, [sdk.wells, wellFunctions, wellFunctionAddress, wellFunctionData]);

  const pump = useMemo(() => {
    if (!pumpAddress) return;
    const existing = pumps.find((p) => p.address.toLowerCase() === pumpAddress.toLowerCase());
    if (existing) return existing;

    return pumpData ? new Pump(sdk.wells, pumpAddress, pumpData) : undefined;
  }, [sdk.wells, pumps, pumpAddress, pumpData]);

  /// ----- Callbacks -----
  const deployWell: CreateWellContext["deployWell"] = useCallback(
    async (saltValue, liquidity) => {
      const toast = new TransactionToast({
        loading: "Deploying Well...",
        error: "Failed to deploy Well",
        success: "Well deployed successfully"
      });

      setDeploying(true);
      Log.module("wellDeployer").debug("Deploying Well...");

      try {
        if (!walletAddress) throw new Error("Wallet not connected");
        if (!wellImplementation) throw new Error("well implementation not set");
        if (!wellFunction) throw new Error("Well function ");
        if (!pump) throw new Error("pump not set");
        if (!wellTokens.token1) throw new Error("token 1 not set");
        if (!wellTokens.token2) throw new Error("token 2 not set");
        if (!wellDetails.name) throw new Error("well name not set");
        if (!wellDetails.symbol) throw new Error("well symbol not set");

        if (liquidity) {
          if (!liquidity.token1Amount?.lte(0) && !liquidity.token2Amount.lte(0)) {
            throw new Error("At least one token amount must be greater than 0 to seed liquidity");
          }
          if (saltValue < 1) {
            throw new Error("Salt value must be greater than 0 if seeding liquidity");
          }
        }

        const aquifer = new Aquifer(sdk.wells, Settings.AQUIFER_ADDRESS);

        const advancedFarm = sdk.farm.createAdvancedFarm("adv-farm");
        const advancedPipe = sdk.farm.createAdvancedPipe("adv-pipe");

        const boreWellParams = await prepareBoreWellParameters(
          aquifer,
          wellImplementation,
          [wellTokens.token1, wellTokens.token2],
          wellFunction,
          pump,
          wellDetails.name,
          wellDetails.symbol,
          saltValue
        );

        Log.module("wellDeployer").debug("boreWellParams: ", boreWellParams);

        const callData = aquifer.contract.interface.encodeFunctionData("boreWell", boreWellParams);

        Log.module("wellDeployer").debug("callData: ", callData);

        Log.module("wellDeployer").debug("liquidity: ", boreWellParams);

        let txn: ContractTransaction;
        let wellAddress: string = "";

        if (liquidity) {
          advancedPipe.add(makeBoreWellStep(aquifer, callData));
          advancedFarm.add(advancedPipe);

          wellAddress = await advancedFarm
            .callStatic(BigNumber.from(0), { slippage: 0.05 })
            .then((result) => decodeBoreWellPipeCall(sdk, aquifer, result) || "");

          if (!wellAddress) {
            throw new Error("Unable to determine well address");
          }

          const well = new Well(sdk.wells, wellAddress);

          // clear the steps
          advancedFarm.clearSteps();
          advancedPipe.clearSteps();

          console.log("advancedFarm: ", advancedFarm);
          console.log("advancedPipe: ", advancedPipe);

          if (advancedFarm.generators.length || advancedPipe.generators.length) {
            throw new Error("Generators are not empty");
          }

          // add transfer token1 to the undeployed well address
          advancedFarm.add(makeLocalOnlyStep("token1-amount", liquidity.token1Amount));
          advancedFarm.add(
            new sdk.farm.actions.TransferToken(
              wellTokens.token1.address,
              well.address,
              FarmFromMode.EXTERNAL,
              FarmToMode.EXTERNAL
            )
          );

          // add transfer token2 to the undeployed well address
          advancedFarm.add(makeLocalOnlyStep("token2-amount", liquidity.token2Amount));
          advancedFarm.add(
            new sdk.farm.actions.TransferToken(
              wellTokens.token2.address,
              well.address,
              FarmFromMode.EXTERNAL,
              FarmToMode.EXTERNAL
            )
          );

          advancedPipe.add(makeBoreWellStep(aquifer, callData));
          advancedPipe.add(
            makeSyncWellStep(
              well,
              wellFunction,
              liquidity.token1Amount,
              liquidity.token2Amount,
              walletAddress
            )
          );

          advancedFarm.add(advancedPipe);

          // build the workflow
          await advancedFarm.estimate(BigNumber.from(0));

          txn = await advancedFarm.execute(BigNumber.from(0), {
            slippage: 0.1 // TODO: Add slippage to form.
          });
        } else {
          txn = await aquifer.contract.boreWell(...boreWellParams);
        }

        toast.confirming(txn);
        Log.module("wellDeployer").debug(`Well deploying... Transaction: ${txn.hash}`);

        const receipt = await txn.wait();
        Log.module("wellDeployer").debug("Well deployed... txn events: ", receipt.events);

        if (!receipt.events?.length) {
          throw new Error("No Bore Well events found");
        }

        toast.success(receipt);
        if (!wellAddress && !liquidity) {
          wellAddress = receipt.events[0].address as string;
        }

        Log.module("wellDeployer").debug("Well deployed at address: ", wellAddress);
      } catch (e) {
        console.error(e);
        toast.error(e);
        return e;
      } finally {
        setDeploying(false);
      }

      return;
    },
    [
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

const makeBoreWellStep = (aquifer: Aquifer, callData: string) => {
  const boreWellStep = async (_amountInStep: ethers.BigNumber, _context: any) => ({
    name: "boreWell",
    amountOut: _amountInStep,
    prepare: () => ({
      target: aquifer.address,
      callData
    }),
    decode: (data: string) => aquifer.contract.interface.decodeFunctionData("boreWell", data),
    decodeResult: (data: string) =>
      aquifer.contract.interface.decodeFunctionResult("boreWell", data)
  });

  return boreWellStep;
};

const makeSyncWellStep = (
  well: Well,
  wellFunction: WellFunction,
  token1Amount: TokenValue,
  token2Amount: TokenValue,
  recipient: string
) => {
  const syncStep = async (_amt: BigNumber, context: { data: { slippage?: number } }) => {
    // this is safe b/c regardless of the wellFunction, all WellFunctions extend IWellFunction, which
    // requires the definition of a 'calcLpTokenSupply' function.
    const calculatedLPSupply = await wellFunction.contract.calcLpTokenSupply(
      [token1Amount.toBigNumber(), token2Amount.toBigNumber()],
      wellFunction.data
    );

    // calculate the minimum LP supply with slippage
    const lpSupplyTV = TokenValue.fromBlockchain(calculatedLPSupply, 0);
    const lpSubSlippage = lpSupplyTV.subSlippage(context.data.slippage ?? 0.1);
    const minLPTrimmed = lpSubSlippage.toHuman().split(".")[0];
    const minLP = BigNumber.from(minLPTrimmed);

    return {
      name: "sync",
      amountOut: minLP,
      prepare: () => ({
        target: well.address,
        // this is safe b/c all wells extend the IWell interface & are required to define a 'sync' function.
        callData: well.contract.interface.encodeFunctionData("sync", [recipient, minLP])
      }),
      decode: (data: string) => well.contract.interface.decodeFunctionData("sync", data),
      decodeResult: (data: string) => well.contract.interface.decodeFunctionResult("sync", data)
    };
  };

  return syncStep;
};
