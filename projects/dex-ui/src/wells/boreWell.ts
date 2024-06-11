import { BeanstalkSDK, ERC20Token, FarmFromMode, FarmToMode, TokenValue } from "@beanstalk/sdk";
import { Aquifer, WellFunction, Pump, Well } from "@beanstalk/sdk-wells";
import { BigNumber, ethers } from "ethers";
import { Settings } from "src/settings";

import { getBytesHexString } from "src/utils/bytes";
import { makeLocalOnlyStep } from "src/utils/workflow/steps";
import { Log } from "src/utils/logger";
import { TransactionToast } from "src/components/TxnToast/TransactionToast";

/**
 * Prepare the parameters for a Aquifer.boreWell call
 */
const prepareBoreWellParameters = async (
  aquifer: Aquifer,
  implementation: string,
  tokens: ERC20Token[], // we assume that these tokens are sorted already
  wellFunction: WellFunction,
  pumps: Pump | Pump[],
  name: string,
  symbol: string,
  salt?: number
) => {
  const immutableData = Aquifer.getEncodedWellImmutableData(
    aquifer.address,
    tokens,
    wellFunction,
    Array.isArray(pumps) ? pumps : [pumps]
  );

  const initFunctionCall = await Aquifer.getEncodedWellInitFunctionData(name, symbol);

  const saltBytes32 = getBytesHexString(salt || 0, 32);

  return [implementation, immutableData, initFunctionCall, saltBytes32] as [
    string,
    Uint8Array,
    Uint8Array,
    string
  ];
};

/**
 * Decode the result of a boreWell wrapped in a advancedPipe callto get the well address
 */
const decodeBoreWellPipeCall = (sdk: BeanstalkSDK, aquifer: Aquifer, pipeResult: string[]) => {
  if (!pipeResult.length) return;
  const pipeDecoded = sdk.contracts.pipeline.interface.decodeFunctionResult(
    "advancedPipe",
    pipeResult[0]
  );

  if (!pipeDecoded?.length || !pipeDecoded[0]?.length) return;
  const boreWellDecoded = aquifer.contract.interface.decodeFunctionResult(
    "boreWell",
    pipeDecoded[0][0]
  );
  if (!boreWellDecoded?.length) return;
  return boreWellDecoded[0] as string;
};

/**
 * Sorts the tokens in the following manner:
 *  - if tokens includes BEAN, BEAN is first
 *  - if tokens includes WETH, WETH is last
 * - otherwise, the token order is preserved
 *
 * this is so that pairs with BEAN are BEAN:X
 * and pairs with WETH are X:WETH
 *
 * TODO: do this with wStETH
 */
const prepareTokenOrderForBoreWell = (sdk: BeanstalkSDK, tokens: ERC20Token[]) => {
  if (tokens.length < 2) {
    throw new Error("2 Tokens are required");
  }

  const wethAddress = sdk.tokens.WETH.address.toLowerCase();
  const beanAddress = sdk.tokens.BEAN.address.toLowerCase();

  return tokens.sort((a, b) => {
    const addressA = a.address.toLowerCase();
    const addressB = b.address.toLowerCase();
    if (addressA === beanAddress || addressB === wethAddress) return -1;
    if (addressB === beanAddress || addressA === wethAddress) return 1;
    return 0;
  });
};

/**
 * function to bore well
 */
const boreWell = async (
  sdk: BeanstalkSDK,
  account: string,
  implementation: string,
  wellFunction: WellFunction,
  pumps: Pump[],
  token1: ERC20Token,
  token2: ERC20Token,
  name: string,
  symbol: string,
  saltValue: number,
  liquidityAmounts: { token1Amount: TokenValue; token2Amount: TokenValue } | undefined,
  toast?: TransactionToast
) => {
  if (liquidityAmounts) {
    if (liquidityAmounts.token1Amount?.lte(0) && liquidityAmounts.token2Amount.lte(0)) {
      throw new Error("At least one token amount must be greater than 0 to seed liquidity");
    }
    if (saltValue < 1) {
      throw new Error("Salt value must be greater than 0 if seeding liquidity");
    }
  }

  const aquifer = new Aquifer(sdk.wells, Settings.AQUIFER_ADDRESS);
  const boreWellParams = await prepareBoreWellParameters(
    aquifer,
    implementation,
    [token1, token2],
    wellFunction,
    pumps,
    name,
    symbol,
    saltValue
  );
  Log.module("boreWell").debug("boreWellParams: ", boreWellParams);

  const callData = aquifer.contract.interface.encodeFunctionData("boreWell", boreWellParams);
  Log.module("boreWell").debug("callData: ", callData);

  let wellAddress: string = "";

  const staticFarm = sdk.farm.createAdvancedFarm("static-farm");
  const advancedFarm = sdk.farm.createAdvancedFarm("adv-farm");
  const advancedPipe = sdk.farm.createAdvancedPipe("adv-pipe");

  advancedPipe.add(makeBoreWellStep(aquifer, callData));

  /// If we are adding liquidity, add steps to advancedFarm & advancedPipe
  if (liquidityAmounts) {
    staticFarm.add(advancedPipe);

    wellAddress = await staticFarm
      .callStatic(BigNumber.from(0), { slippage: 0.05 })
      .then((result) => decodeBoreWellPipeCall(sdk, aquifer, result) || "");

    if (!wellAddress) {
      throw new Error("Unable to determine well address");
    }

    const well = new Well(sdk.wells, wellAddress);
    Log.module("boreWell").debug("Expected Well Address: ", wellAddress);

    // add transfer token1 to the undeployed well address
    advancedFarm.add(makeLocalOnlyStep("token1-amount", liquidityAmounts.token1Amount), {
      onlyLocal: true
    });
    advancedFarm.add(
      new sdk.farm.actions.TransferToken(
        token1.address,
        well.address,
        FarmFromMode.EXTERNAL,
        FarmToMode.EXTERNAL
      )
    );

    // add transfer token2 to the undeployed well address
    advancedFarm.add(makeLocalOnlyStep("token2-amount", liquidityAmounts.token2Amount), {
      onlyLocal: true
    });
    advancedFarm.add(
      new sdk.farm.actions.TransferToken(
        token2.address,
        well.address,
        FarmFromMode.EXTERNAL,
        FarmToMode.EXTERNAL
      )
    );

    advancedPipe.add(
      makeSyncWellStep(
        well,
        wellFunction,
        liquidityAmounts.token1Amount,
        liquidityAmounts.token2Amount,
        account
      )
    );
  }

  advancedFarm.add(advancedPipe);

  // build the workflow
  await advancedFarm.estimate(BigNumber.from(0));
  const txn = await advancedFarm.execute(BigNumber.from(0), {
    slippage: 0.1 // TODO: Add slippage to form.
  });

  toast?.confirming(txn);
  Log.module("wellDeployer").debug(`Well deploying... Transaction: ${txn.hash}`);

  const receipt = await txn.wait();
  Log.module("wellDeployer").debug("Well deployed... txn events: ", receipt.events);

  if (!receipt.events?.length) {
    throw new Error("No Bore Well events found");
  }

  toast?.success(receipt);

  if (!wellAddress && !liquidityAmounts) {
    wellAddress = receipt.events[0].address as string;
  }

  return {
    wellAddress,
    receipt
  };
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

const BoreWellUtils = {
  prepareBoreWellParameters,
  decodeBoreWellPipeCall,
  prepareTokenOrderForBoreWell,
  boreWell
};

export default BoreWellUtils;
