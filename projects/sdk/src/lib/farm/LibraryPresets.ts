import { ethers } from "ethers";
import { ERC20Token, NativeToken, Token } from "src/classes/Token";
import { BasicPreparedResult, RunContext, StepGenerator } from "src/classes/Workflow";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { FarmFromMode, FarmToMode } from "../farm/types";
import { EIP2612PermitMessage, SignedPermit } from "../permit";
import { BasinWell } from "src/classes/Pool/BasinWell";

export type ActionBuilder = (
  fromMode?: FarmFromMode,
  toMode?: FarmToMode
) => StepGenerator<BasicPreparedResult> | StepGenerator<BasicPreparedResult>[];

export class LibraryPresets {
  static sdk: BeanstalkSDK;

  public readonly wellSwap;
  public readonly wellAddLiquidity;
  public readonly uniswapV3Swap;
  public readonly uniV3AddLiquidity;
  public readonly uniV3WellSwap;
  public readonly wellSwapUniV3;

  public readonly stable2Bean;
  public readonly bean2Stable;
  public readonly stable2beanWstETH;
  public readonly stable2wstETH;

  /**
   * Load the Pipeline in preparation for a set Pipe actions.
   * @param _permit provide a permit directly, or provide a function to extract it from `context`.
   */
  public loadPipeline(
    _token: ERC20Token,
    _from: FarmFromMode,
    _permit?:
      | SignedPermit<EIP2612PermitMessage>
      | ((context: RunContext) => SignedPermit<EIP2612PermitMessage>)
  ) {
    let generators: StepGenerator[] = [];

    // FIXME: use permitToken if _from === INTERNAL
    if (_token instanceof NativeToken) {
      console.warn(
        "!! WARNING: Skipping loadPipeline with expectation that ether is passed through { value }."
      );
      return generators;
    }

    // give beanstalk permission to send this ERC-20 token from my balance -> pipeline
    if (_permit) {
      if (_from === FarmFromMode.EXTERNAL) {
        generators.push(async function permitERC20(
          _amountInStep: ethers.BigNumber,
          context: RunContext
        ) {
          const permit = typeof _permit === "function" ? _permit(context) : _permit;
          const owner = await LibraryPresets.sdk.getAccount();
          const spender = LibraryPresets.sdk.contracts.beanstalk.address;

          LibraryPresets.sdk.debug(`[permitERC20.run()]`, {
            token: _token.address,
            owner: owner,
            spender: spender,
            value: _amountInStep.toString(),
            permit: permit
          });

          return {
            target: LibraryPresets.sdk.contracts.beanstalk.address,
            callData: LibraryPresets.sdk.contracts.beanstalk.interface.encodeFunctionData(
              "permitERC20",
              [
                _token.address, // token address
                owner, // owner
                spender, // spender
                _amountInStep.toString(), // value
                permit.typedData.message.deadline, // deadline
                permit.split.v,
                permit.split.r,
                permit.split.s
              ]
            )
          };
        });
      } else {
        throw new Error(
          `Permit provided for FarmFromMode that does not yet support permits: ${_from}`
        );
      }
    }

    // transfer erc20 token from msg.sender -> PIPELINE
    generators.push(async function transferToken(_amountInStep: ethers.BigNumber) {
      const recipient = LibraryPresets.sdk.contracts.pipeline.address;

      LibraryPresets.sdk.debug(`[transferToken.run()]`, {
        token: _token.address,
        recipient,
        amount: _amountInStep.toString(),
        from: _from,
        to: FarmToMode.EXTERNAL
      });

      return {
        target: LibraryPresets.sdk.contracts.beanstalk.address,
        callData: LibraryPresets.sdk.contracts.beanstalk.interface.encodeFunctionData(
          "transferToken",
          [
            _token.address, // token
            recipient, // recipient
            _amountInStep.toString(), // amount
            _from, // from
            FarmToMode.EXTERNAL // to
          ]
        )
      };
    });

    return generators;
  }

  constructor(sdk: BeanstalkSDK) {
    LibraryPresets.sdk = sdk;

    const stables = [sdk.tokens.DAI, sdk.tokens.USDC, sdk.tokens.USDT];

    ///////// BEAN:wstETH Well ///////////
    // STABLE -> BEAN:wstETH LP
    this.stable2beanWstETH = (
      fromToken: ERC20Token,
      account: string,
      fromMode?: FarmFromMode,
      _toMode?: FarmToMode
    ) => {
      if (!stables.some((t) => t.equals(fromToken))) {
        throw new Error(
          `[stable2wstETH] expected tokenIn to be DAI, USDC, USDT, but got ${fromToken.symbol}`
        );
      }

      return [
        this.uniswapV3Swap(fromToken, sdk.tokens.WETH, account, 500, fromMode, FarmToMode.INTERNAL),
        this.uniV3AddLiquidity(
          sdk.pools.BEAN_WSTETH_WELL,
          account,
          sdk.tokens.WETH,
          sdk.tokens.WSTETH,
          100,
          FarmFromMode.INTERNAL_TOLERANT
        )
      ];
    };

    // BEAN->USDC/USDT/DAI via Pipeline
    // shortest path is BEAN:WETH(well) => WETH:STABLE(uniV3)
    // but we want to route swap through bean:wstETH b/c that's where the liquidity is
    // eventually we'd want to have a router that will allow the user to pick a path / choose the best route
    // thus the path for the best price is BEAN->wstETH(well) => wstETH->WETH(univ3) => WETH->STABLE(univ3)
    this.bean2Stable = (
      toToken: ERC20Token,
      account: string,
      fromMode?: FarmFromMode,
      toMode?: FarmToMode
    ) => {
      return [
        this.wellSwapUniV3(
          sdk.pools.BEAN_WSTETH_WELL,
          account,
          sdk.tokens.BEAN,
          sdk.tokens.WSTETH,
          sdk.tokens.WETH,
          100,
          fromMode,
          FarmToMode.INTERNAL
        ),
        this.uniswapV3Swap(sdk.tokens.WETH, toToken, account, 500, FarmFromMode.INTERNAL, toMode)
      ];
    };

    // USDC/USDT/DAI->BEAN via Pipeline
    // shortest path is // shortest path is WETH:STABLE(uniV3) => BEAN:WETH(well)
    // but we want to route swap through bean:wstETH b/c that's where the liquidity is
    // eventually we'd want to have a router that will allow the user to pick a path / choose the best route
    // thus the path for the best price is STABLE->WETH(univ3) => WETH->wstETH(univ3) => wstETH->BEAN(well)
    this.stable2Bean = (
      fromToken: ERC20Token,
      account: string,
      fromMode?: FarmFromMode,
      toMode?: FarmToMode
    ) => {
      return [
        this.uniswapV3Swap(fromToken, sdk.tokens.WETH, account, 500, fromMode, FarmToMode.INTERNAL),
        this.uniV3WellSwap(
          sdk.pools.BEAN_WSTETH_WELL,
          account,
          sdk.tokens.WETH,
          sdk.tokens.WSTETH,
          sdk.tokens.BEAN,
          100,
          FarmFromMode.INTERNAL_TOLERANT,
          toMode
        )
      ];
    };

    ///////// USDC/USDT/DAI -> WstETH ///////////
    this.stable2wstETH = (
      fromToken: ERC20Token,
      account: string,
      fromMode?: FarmFromMode,
      toMode?: FarmToMode
    ) => {
      const validInputs = [sdk.tokens.DAI, sdk.tokens.USDC, sdk.tokens.USDT];

      if (!validInputs.some((t) => t.equals(fromToken))) {
        throw new Error(
          `[stable2wstETH] expected tokenIn to be DAI, USDC, USDT, but got ${fromToken.symbol}`
        );
      }

      return [
        this.uniswapV3Swap(fromToken, sdk.tokens.WETH, account, 500, fromMode, FarmToMode.INTERNAL),
        this.uniswapV3Swap(
          sdk.tokens.WETH,
          sdk.tokens.WSTETH,
          account,
          100,
          FarmFromMode.INTERNAL_TOLERANT,
          toMode
        )
      ];
    };

    // ETH/WETH -> wstETH

    ///////// BEAN <> WETH ///////////
    this.wellSwap = (
      well: BasinWell,
      fromToken: ERC20Token,
      toToken: ERC20Token,
      account: string,
      from?: FarmFromMode,
      to?: FarmToMode
    ) => {
      const result = [];

      // Set up the AdvancedPipe workflow that will call Wells via Pipeline
      const advancedPipe = sdk.farm.createAdvancedPipe("pipelineWellSwap");

      // If the TO mode is INTERNAL that means this is not the last step of a swap/workflow.
      // We must transfer result of the swap back to User's INTERNAL balance on Beanstalk.
      // This means setting the swap recipient to Pipeline, have Pipeline approve Beanstalk to spend
      // the output token, then transfer the output token from Pipeline's external balance to User's INTERNAL balance
      const transferBack = to === FarmToMode.INTERNAL;

      // When transferBack is true, we tell Wells to send the swap result to Pipeline, otherwise
      // send it directly to the User
      const recipient = transferBack ? sdk.contracts.pipeline.address : account;

      // Transfer input token to Well
      const transfer = new sdk.farm.actions.TransferToken(
        fromToken.address,
        well.address,
        from,
        FarmToMode.EXTERNAL
      );

      // Swap fromToken -> toToken on Well, send output back to recipient (either the User or Pipeline)
      const swap = new sdk.farm.actions.WellShift(well.address, fromToken, toToken, recipient);

      // This approves the transferToBeanstalk operation. Used when transferBack == true
      const approveClipboard = {
        tag: "swap",
        copySlot: 0,
        pasteSlot: 1
      };
      const approveBack = new sdk.farm.actions.ApproveERC20(
        toToken,
        sdk.contracts.beanstalk.address,
        approveClipboard
      );

      // This transfers the output token back to Beanstalk, from Pipeline. Used when transferBack == true
      const transferClipboard = {
        tag: "swap",
        copySlot: 0,
        pasteSlot: 2
      };
      const transferToBeanstalk = new sdk.farm.actions.TransferToken(
        toToken.address,
        account,
        FarmFromMode.EXTERNAL,
        FarmToMode.INTERNAL,
        transferClipboard
      );

      // Compose the steps
      result.push(transfer);
      advancedPipe.add(swap, { tag: "swap" });
      if (transferBack) {
        advancedPipe.add(approveBack);
        advancedPipe.add(transferToBeanstalk);
      }
      result.push(advancedPipe);

      return result;
    };

    ///////// [ BEAN, WETH, WSTETH ] -> BEANETH/BEANWSTETH ///////////
    this.wellAddLiquidity = (
      well: BasinWell,
      tokenIn: ERC20Token,
      account: string,
      from?: FarmFromMode,
      to?: FarmToMode,
      options?: {
        /**
         * Whether or not this is a mid-pipeline step.
         * If true, we will add all steps to pipeline. Otherwise, add all steps assuming it is the first step.
         */
        isMidPipe?: boolean;
      }
    ) => {
      const result = [];
      const advancedPipe = sdk.farm.createAdvancedPipe("pipelineDeposit");

      const transferBack = to === FarmToMode.INTERNAL;
      const recipient = transferBack ? sdk.contracts.pipeline.address : account;

      // Transfer input token to WELL
      const transfer = new sdk.farm.actions.TransferToken(
        tokenIn.address,
        well.address,
        from,
        FarmToMode.EXTERNAL
      );

      // Call sync on WELL
      const addLiquidity = new sdk.farm.actions.WellSync(well, tokenIn, recipient);

      // This approves the transferToBeanstalk operation.
      const approveClipboard = {
        tag: "amountToDeposit",
        copySlot: 0,
        pasteSlot: 1
      };
      const approveBack = new sdk.farm.actions.ApproveERC20(
        well.lpToken,
        sdk.contracts.beanstalk.address,
        approveClipboard
      );

      // Transfers the output token back to Beanstalk, from PIPELINE.
      const transferClipboard = {
        tag: "amountToDeposit",
        copySlot: 0,
        pasteSlot: 2
      };
      const transferToBeanstalk = new sdk.farm.actions.TransferToken(
        well.address,
        account,
        FarmFromMode.EXTERNAL,
        FarmToMode.INTERNAL,
        transferClipboard
      );

      if (options?.isMidPipe) {
        advancedPipe.add(transfer);
      } else {
        result.push(transfer);
      }

      advancedPipe.add(addLiquidity, { tag: "amountToDeposit" });
      if (transferBack) {
        advancedPipe.add(approveBack);
        advancedPipe.add(transferToBeanstalk);
      }

      result.push(advancedPipe);

      return result;
    };

    this.uniswapV3Swap = (
      fromToken: ERC20Token,
      toToken: ERC20Token,
      account: string,
      uniswapFeeTier: number,
      from?: FarmFromMode,
      to?: FarmToMode
    ) => {
      const result = [];
      const advancedPipe = sdk.farm.createAdvancedPipe("pipelineUniswapV3Swap");

      const transferBack = to === FarmToMode.INTERNAL;
      const recipient = transferBack ? sdk.contracts.pipeline.address : account;

      // Transfer fromToken to Pipeline
      const transfer = new sdk.farm.actions.TransferToken(
        fromToken.address,
        sdk.contracts.pipeline.address,
        from,
        FarmToMode.EXTERNAL
      );

      // Approve Uniswap V3 to use fromToken
      const approveUniswap = new sdk.farm.actions.ApproveERC20(
        fromToken,
        sdk.contracts.uniswapV3Router.address
      );

      // Swap fromToken -> toToken using Uniswap V3
      const swap = new sdk.farm.actions.UniswapV3Swap(
        fromToken,
        toToken,
        recipient,
        uniswapFeeTier
      );

      // This approves the transferToBeanstalk operation.
      const approveClipboard = {
        tag: "uniV3SwapAmount",
        copySlot: 0,
        pasteSlot: 1
      };
      const approveBack = new sdk.farm.actions.ApproveERC20(
        toToken,
        sdk.contracts.beanstalk.address,
        approveClipboard
      );

      // Transfers toToken back to Beanstalk, from Pipeline.
      const transferClipboard = {
        tag: "uniV3SwapAmount",
        copySlot: 0,
        pasteSlot: 2
      };
      const transferToBeanstalk = new sdk.farm.actions.TransferToken(
        toToken.address,
        account,
        FarmFromMode.EXTERNAL,
        FarmToMode.INTERNAL,
        transferClipboard
      );

      result.push(transfer);
      advancedPipe.add(approveUniswap);
      advancedPipe.add(swap, { tag: "uniV3SwapAmount" });
      if (transferBack) {
        advancedPipe.add(approveBack);
        advancedPipe.add(transferToBeanstalk);
      }

      result.push(advancedPipe);

      return result;
    };

    this.uniV3AddLiquidity = (
      well: BasinWell,
      account: string,
      fromToken: ERC20Token,
      thruToken: ERC20Token,
      uniswapFeeTier: number,
      fromMode?: FarmFromMode
    ) => {
      const result = [];
      const advancedPipe = sdk.farm.createAdvancedPipe("pipelineUniV3Deposit");

      // Transfer fromToken to Pipeline
      const transfer = new sdk.farm.actions.TransferToken(
        fromToken.address,
        sdk.contracts.pipeline.address,
        fromMode,
        FarmToMode.EXTERNAL
      );

      // Approve Uniswap V3 to use fromToken
      const approveUniswap = new sdk.farm.actions.ApproveERC20(
        fromToken,
        sdk.contracts.uniswapV3Router.address
      );

      // Swap fromToken -> thruToken on Uniswap V3, output result to Well
      const swap = new sdk.farm.actions.UniswapV3Swap(
        fromToken,
        thruToken,
        well.address,
        uniswapFeeTier
      );

      // Call sync on Well, send output (LP tokens) back to Pipeline
      const addLiquidity = new sdk.farm.actions.WellSync(
        well,
        thruToken,
        sdk.contracts.pipeline.address
      );

      // This approves the transferToBeanstalk operation.
      const approveClipboard = {
        tag: "amountToDeposit",
        copySlot: 0,
        pasteSlot: 1
      };
      const approveBack = new sdk.farm.actions.ApproveERC20(
        well.lpToken,
        sdk.contracts.beanstalk.address,
        approveClipboard
      );

      // Transfers the output token back to Beanstalk, from Pipeline.
      const transferClipboard = {
        tag: "amountToDeposit",
        copySlot: 0,
        pasteSlot: 2
      };
      const transferToBeanstalk = new sdk.farm.actions.TransferToken(
        well.address,
        account,
        FarmFromMode.EXTERNAL,
        FarmToMode.INTERNAL,
        transferClipboard
      );

      result.push(transfer);

      advancedPipe.add(approveUniswap);
      advancedPipe.add(swap);
      advancedPipe.add(addLiquidity, { tag: "amountToDeposit" });
      advancedPipe.add(approveBack);
      advancedPipe.add(transferToBeanstalk);

      result.push(advancedPipe);
      return result;
    };

    this.uniV3WellSwap = (
      well: BasinWell,
      account: string,
      fromToken: ERC20Token,
      thruToken: ERC20Token,
      toToken: ERC20Token,
      uniswapFeeTier: number,
      fromMode?: FarmFromMode,
      toMode?: FarmToMode
    ) => {
      const result = [];
      const advancedPipe = sdk.farm.createAdvancedPipe("pipelineUniV3WellSwap");

      const transferBack = toMode === FarmToMode.INTERNAL;
      const recipient = transferBack ? sdk.contracts.pipeline.address : account;

      // Transfer fromToken to Pipeline
      const transfer = new sdk.farm.actions.TransferToken(
        fromToken.address,
        sdk.contracts.pipeline.address,
        fromMode,
        FarmToMode.EXTERNAL
      );

      // Approve Uniswap V3 to use fromToken
      const approveUniswap = new sdk.farm.actions.ApproveERC20(
        fromToken,
        sdk.contracts.uniswapV3Router.address
      );

      // Swap fromToken -> thruToken on Uniswap V3, send output to Well
      const swap = new sdk.farm.actions.UniswapV3Swap(
        fromToken,
        thruToken,
        well.address,
        uniswapFeeTier
      );

      // Swap thruToken -> toToken on Well, send output to recipient
      const wellSwap = new sdk.farm.actions.WellShift(well.address, thruToken, toToken, recipient);

      // This approves the transferToBeanstalk operation.
      const approveClipboard = {
        tag: "swapOutput",
        copySlot: 0,
        pasteSlot: 1
      };
      const approveBack = new sdk.farm.actions.ApproveERC20(
        toToken,
        sdk.contracts.beanstalk.address,
        approveClipboard
      );

      // Transfers toToken back to Beanstalk, from Pipeline.
      const transferClipboard = {
        tag: "swapOutput",
        copySlot: 0,
        pasteSlot: 2
      };
      const transferToBeanstalk = new sdk.farm.actions.TransferToken(
        toToken.address,
        account,
        FarmFromMode.EXTERNAL,
        FarmToMode.INTERNAL,
        transferClipboard
      );

      result.push(transfer);

      advancedPipe.add(approveUniswap);
      advancedPipe.add(swap);
      advancedPipe.add(wellSwap, { tag: "swapOutput" });
      if (transferBack) {
        advancedPipe.add(approveBack);
        advancedPipe.add(transferToBeanstalk);
      }

      result.push(advancedPipe);
      return result;
    };

    this.wellSwapUniV3 = (
      well: BasinWell,
      account: string,
      fromToken: ERC20Token,
      thruToken: ERC20Token,
      toToken: ERC20Token,
      uniswapFeeTier: number,
      fromMode?: FarmFromMode,
      toMode?: FarmToMode
    ) => {
      const result = [];
      const advancedPipe = sdk.farm.createAdvancedPipe("pipelineWellSwapUniV3");

      const transferBack = toMode === FarmToMode.INTERNAL;
      const recipient = transferBack ? sdk.contracts.pipeline.address : account;

      // Transfer fromToken to Well
      const transfer = new sdk.farm.actions.TransferToken(
        fromToken.address,
        well.address,
        fromMode,
        FarmToMode.EXTERNAL
      );

      // Swap fromToken -> thruToken on Well, send output back to Pipeline
      const wellSwap = new sdk.farm.actions.WellShift(
        well.address,
        fromToken,
        thruToken,
        sdk.contracts.pipeline.address
      );

      // Approve Uniswap V3 to use thruToken
      const uniApproveClipboard = {
        tag: "swapOutput",
        copySlot: 0,
        pasteSlot: 1
      };
      const approveUniswap = new sdk.farm.actions.ApproveERC20(
        thruToken,
        sdk.contracts.uniswapV3Router.address,
        uniApproveClipboard
      );

      // Swap thruToken -> toToken on Uniswap V3, send output to recipient
      const uniClipboard = {
        tag: "swapOutput",
        copySlot: 0,
        pasteSlot: 5
      };
      const swap = new sdk.farm.actions.UniswapV3Swap(
        thruToken,
        toToken,
        recipient,
        uniswapFeeTier,
        undefined,
        uniClipboard
      );

      // This approves the transferToBeanstalk operation.
      const transferApproveClipboard = {
        tag: "uniV3Output",
        copySlot: 0,
        pasteSlot: 1
      };
      const approveBack = new sdk.farm.actions.ApproveERC20(
        toToken,
        sdk.contracts.beanstalk.address,
        transferApproveClipboard
      );

      // Transfers toToken back to Beanstalk, from Pipeline.
      const transferClipboard = {
        tag: "uniV3Output",
        copySlot: 0,
        pasteSlot: 2
      };
      const transferToBeanstalk = new sdk.farm.actions.TransferToken(
        toToken.address,
        account,
        FarmFromMode.EXTERNAL,
        FarmToMode.INTERNAL,
        transferClipboard
      );

      result.push(transfer);

      advancedPipe.add(wellSwap, { tag: "swapOutput" });
      advancedPipe.add(approveUniswap);
      advancedPipe.add(swap, { tag: "uniV3Output" });
      if (transferBack) {
        advancedPipe.add(approveBack);
        advancedPipe.add(transferToBeanstalk);
      }

      result.push(advancedPipe);
      return result;
    };
  }
}

// public readonly weth2usdt: ActionBuilder;
// public readonly usdt2weth: ActionBuilder;
// public readonly weth2bean3crv: ActionBuilder;

// public readonly dai2usdt;
// public readonly usdc2usdt;

// public readonly dai2weth;
// public readonly usdc2weth;

// public readonly usdt23crv;
// public readonly usdc2beaneth;
// public readonly usdt2beaneth;
// public readonly dai2beaneth;

///////// WETH <> USDT ///////////
// this.weth2usdt = (fromMode?: FarmFromMode, toMode?: FarmToMode) =>
//   new Exchange(
//     sdk.contracts.curve.pools.tricrypto2.address,
//     sdk.contracts.curve.registries.cryptoFactory.address,
//     sdk.tokens.WETH,
//     sdk.tokens.USDT,
//     fromMode,
//     toMode
//   );

// this.usdt2weth = (fromMode?: FarmFromMode, toMode?: FarmToMode) =>
//   new Exchange(
//     sdk.contracts.curve.pools.tricrypto2.address,
//     sdk.contracts.curve.registries.cryptoFactory.address,
//     sdk.tokens.USDT,
//     sdk.tokens.WETH,
//     fromMode,
//     toMode
//   );

///////// WETH  -> 3CRV ///////////
// this.weth2bean3crv = (fromMode?: FarmFromMode, toMode?: FarmToMode) => [
//   this.weth2usdt(fromMode, FarmToMode.INTERNAL) as StepGenerator,
//   this.usdt23crv(fromMode, FarmToMode.INTERNAL) as StepGenerator
// ];

//////// USDT -> 3CRV  ////////
// this.usdt23crv = (fromMode?: FarmFromMode, toMode?: FarmToMode) => {
//   const pool = sdk.contracts.curve.pools.pool3.address;
//   const registry = sdk.contracts.curve.registries.poolRegistry.address;
//   // [0 ,0 , 1] is for USDT; [DAI, USDC, USDT]
//   return new sdk.farm.actions.AddLiquidity(pool, registry, [0, 0, 1], fromMode, toMode);
// };

///////// DAI -> USDT ///////////
// this.dai2usdt = (fromMode?: FarmFromMode, toMode?: FarmToMode) =>
//   new Exchange(
//     sdk.contracts.curve.pools.pool3.address,
//     sdk.contracts.curve.registries.poolRegistry.address,
//     sdk.tokens.DAI,
//     sdk.tokens.USDT,
//     fromMode,
//     toMode
//   );

///////// USDC -> USDT ///////////
// this.usdc2usdt = (fromMode?: FarmFromMode, toMode?: FarmToMode) =>
//   new Exchange(
//     sdk.contracts.curve.pools.pool3.address,
//     sdk.contracts.curve.registries.poolRegistry.address,
//     sdk.tokens.USDC,
//     sdk.tokens.USDT,
//     fromMode,
//     toMode
//   );

///////// [ USDC, USDT, DAI ] -> BEANETH ///////////
// this.usdc2beaneth = (
//   well: BasinWell,
//   account: string,
//   fromMode?: FarmFromMode,
//   toMode?: FarmToMode
// ) => [this.uniV3AddLiquidity(well, account, sdk.tokens.USDC, sdk.tokens.WETH, 500, fromMode)];

// this.usdt2beaneth = (
//   well: BasinWell,
//   account: string,
//   fromMode?: FarmFromMode,
//   toMode?: FarmToMode
// ) => [
//   this.usdt2weth(fromMode, FarmToMode.INTERNAL) as StepGenerator,
//   this.wellAddLiquidity(well, sdk.tokens.WETH, account, FarmFromMode.INTERNAL, toMode)
// ];

// this.dai2beaneth = (
//   well: BasinWell,
//   account: string,
//   fromMode?: FarmFromMode,
//   toMode?: FarmToMode
// ) => [this.uniV3AddLiquidity(well, account, sdk.tokens.DAI, sdk.tokens.WETH, 500, fromMode)];