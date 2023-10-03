import { ethers } from "ethers";
import { ERC20Token, NativeToken, Token } from "src/classes/Token";
import { BasicPreparedResult, RunContext, StepGenerator } from "src/classes/Workflow";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { FarmFromMode, FarmToMode } from "../farm/types";
import { EIP2612PermitMessage, SignedPermit } from "../permit";
import { Exchange, ExchangeUnderlying } from "./actions/index";
import { BasinWell } from "src/classes/Pool/BasinWell";

export type ActionBuilder = (
  fromMode?: FarmFromMode,
  toMode?: FarmToMode
) => StepGenerator<BasicPreparedResult> | StepGenerator<BasicPreparedResult>[];

export class LibraryPresets {
  static sdk: BeanstalkSDK;
  public readonly weth2usdt: ActionBuilder;
  public readonly usdt2weth: ActionBuilder;

  public readonly usdt2bean: ActionBuilder;
  public readonly bean2usdt: ActionBuilder;

  public readonly weth2bean: ActionBuilder;
  public readonly bean2weth: ActionBuilder;
  public readonly weth2bean3crv: ActionBuilder;
  public readonly wellWethBean;
  public readonly wellAddLiquidity;

  public readonly usdc2bean: ActionBuilder;
  public readonly bean2usdc: ActionBuilder;

  public readonly dai2bean: ActionBuilder;
  public readonly bean2dai: ActionBuilder;

  public readonly dai2usdt: ActionBuilder;
  public readonly usdc2usdt: ActionBuilder;

  public readonly dai2weth: ActionBuilder;
  public readonly usdc2weth: ActionBuilder;

  public readonly usdt23crv: ActionBuilder;
  public readonly usdc2beaneth;
  public readonly usdt2beaneth;
  public readonly dai2beaneth;

  /**
   * Load the Pipeline in preparation for a set Pipe actions.
   * @param _permit provide a permit directly, or provide a function to extract it from `context`.
   */
  public loadPipeline(
    _token: ERC20Token,
    _from: FarmFromMode,
    _permit?: SignedPermit<EIP2612PermitMessage> | ((context: RunContext) => SignedPermit<EIP2612PermitMessage>)
  ) {
    let generators: StepGenerator[] = [];

    // FIXME: use permitToken if _from === INTERNAL
    if (_token instanceof NativeToken) {
      console.warn("!! WARNING: Skipping loadPipeline with expectation that ether is passed through { value }.");
      return generators;
    }

    // give beanstalk permission to send this ERC-20 token from my balance -> pipeline
    if (_permit) {
      if (_from === FarmFromMode.EXTERNAL) {
        generators.push(async function permitERC20(_amountInStep: ethers.BigNumber, context: RunContext) {
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
            callData: LibraryPresets.sdk.contracts.beanstalk.interface.encodeFunctionData("permitERC20", [
              _token.address, // token address
              owner, // owner
              spender, // spender
              _amountInStep.toString(), // value
              permit.typedData.message.deadline, // deadline
              permit.split.v,
              permit.split.r,
              permit.split.s
            ])
          };
        });
      } else {
        throw new Error(`Permit provided for FarmFromMode that does not yet support permits: ${_from}`);
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
        callData: LibraryPresets.sdk.contracts.beanstalk.interface.encodeFunctionData("transferToken", [
          _token.address, // token
          recipient, // recipient
          _amountInStep.toString(), // amount
          _from, // from
          FarmToMode.EXTERNAL // to
        ])
      };
    });

    return generators;
  }

  constructor(sdk: BeanstalkSDK) {
    LibraryPresets.sdk = sdk;

    ///////// WETH <> USDT ///////////
    this.weth2usdt = (fromMode?: FarmFromMode, toMode?: FarmToMode) =>
      new Exchange(
        sdk.contracts.curve.pools.tricrypto2.address,
        sdk.contracts.curve.registries.cryptoFactory.address,
        sdk.tokens.WETH,
        sdk.tokens.USDT,
        fromMode,
        toMode
      );

    this.usdt2weth = (fromMode?: FarmFromMode, toMode?: FarmToMode) =>
      new Exchange(
        sdk.contracts.curve.pools.tricrypto2.address,
        sdk.contracts.curve.registries.cryptoFactory.address,
        sdk.tokens.USDT,
        sdk.tokens.WETH,
        fromMode,
        toMode
      );

    ///////// USDT <> BEAN ///////////
    this.usdt2bean = (fromMode?: FarmFromMode, toMode?: FarmToMode) =>
      new ExchangeUnderlying(sdk.contracts.curve.pools.beanCrv3.address, sdk.tokens.USDT, sdk.tokens.BEAN, fromMode, toMode);

    this.bean2usdt = (fromMode?: FarmFromMode, toMode?: FarmToMode) =>
      new ExchangeUnderlying(sdk.contracts.curve.pools.beanCrv3.address, sdk.tokens.BEAN, sdk.tokens.USDT, fromMode, toMode);

    ///////// USDC <> BEAN ///////////
    this.usdc2bean = (fromMode?: FarmFromMode, toMode?: FarmToMode) =>
      new ExchangeUnderlying(sdk.contracts.curve.pools.beanCrv3.address, sdk.tokens.USDC, sdk.tokens.BEAN, fromMode, toMode);

    this.bean2usdc = (fromMode?: FarmFromMode, toMode?: FarmToMode) =>
      new ExchangeUnderlying(sdk.contracts.curve.pools.beanCrv3.address, sdk.tokens.BEAN, sdk.tokens.USDC, fromMode, toMode);

    ///////// DAI <> BEAN ///////////
    this.dai2bean = (fromMode?: FarmFromMode, toMode?: FarmToMode) =>
      new ExchangeUnderlying(sdk.contracts.curve.pools.beanCrv3.address, sdk.tokens.DAI, sdk.tokens.BEAN, fromMode, toMode);

    this.bean2dai = (fromMode?: FarmFromMode, toMode?: FarmToMode) =>
      new ExchangeUnderlying(sdk.contracts.curve.pools.beanCrv3.address, sdk.tokens.BEAN, sdk.tokens.DAI, fromMode, toMode);

    //////// WETH <> BEAN
    this.weth2bean = (fromMode?: FarmFromMode, toMode?: FarmToMode) => [
      this.weth2usdt(fromMode, FarmToMode.INTERNAL) as StepGenerator,
      this.usdt2bean(FarmFromMode.INTERNAL, toMode) as StepGenerator
    ];

    this.bean2weth = (fromMode?: FarmFromMode, toMode?: FarmToMode) => [
      this.bean2usdt(fromMode, FarmToMode.INTERNAL) as StepGenerator,
      this.usdt2weth(FarmFromMode.INTERNAL, toMode) as StepGenerator
    ];

    ///////// WETH  -> 3CRV ///////////
    this.weth2bean3crv = (fromMode?: FarmFromMode, toMode?: FarmToMode) => [
      this.weth2usdt(fromMode, FarmToMode.INTERNAL) as StepGenerator,
      this.usdt23crv(fromMode, FarmToMode.INTERNAL) as StepGenerator
    ];

    //////// USDT -> 3CRV  ////////
    this.usdt23crv = (fromMode?: FarmFromMode, toMode?: FarmToMode) => {
      const pool = sdk.contracts.curve.pools.pool3.address;
      const registry = sdk.contracts.curve.registries.poolRegistry.address;
      // [0 ,0 , 1] is for USDT; [DAI, USDC, USDT]
      return new sdk.farm.actions.AddLiquidity(pool, registry, [0, 0, 1], fromMode, toMode);
    };

    ///////// DAI -> USDT ///////////
    this.dai2usdt = (fromMode?: FarmFromMode, toMode?: FarmToMode) =>
      new Exchange(
        sdk.contracts.curve.pools.pool3.address,
        sdk.contracts.curve.registries.poolRegistry.address,
        sdk.tokens.DAI,
        sdk.tokens.USDT,
        fromMode,
        toMode
      );

    ///////// USDC -> USDT ///////////
    this.usdc2usdt = (fromMode?: FarmFromMode, toMode?: FarmToMode) =>
      new Exchange(
        sdk.contracts.curve.pools.pool3.address,
        sdk.contracts.curve.registries.poolRegistry.address,
        sdk.tokens.USDC,
        sdk.tokens.USDT,
        fromMode,
        toMode
      );

    ///////// DAI -> WETH ///////////
    this.dai2weth = (fromMode?: FarmFromMode, toMode?: FarmToMode) => [
      this.dai2usdt(fromMode, FarmToMode.INTERNAL) as StepGenerator,
      this.usdt2weth(FarmFromMode.INTERNAL, toMode) as StepGenerator
    ];

    ///////// USDC -> WETH ///////////
    this.usdc2weth = (fromMode?: FarmFromMode, toMode?: FarmToMode) => [
      this.usdc2usdt(fromMode, FarmToMode.INTERNAL) as StepGenerator,
      this.usdt2weth(FarmFromMode.INTERNAL, toMode) as StepGenerator
    ];

    ///////// [ USDC, USDT, DAI ] -> BEANETH ///////////
    this.usdc2beaneth = (well: BasinWell, account: string, fromMode?: FarmFromMode, toMode?: FarmToMode) => [
      this.usdc2weth(fromMode, FarmToMode.INTERNAL) as StepGenerator,
      this.wellAddLiquidity(well, sdk.tokens.WETH, account, FarmFromMode.INTERNAL, toMode)
    ];

    this.usdt2beaneth = (well: BasinWell, account: string, fromMode?: FarmFromMode, toMode?: FarmToMode) => [
      this.usdt2weth(fromMode, FarmToMode.INTERNAL) as StepGenerator,
      this.wellAddLiquidity(well, sdk.tokens.WETH, account, FarmFromMode.INTERNAL, toMode)
    ];

    this.dai2beaneth = (well: BasinWell, account: string, fromMode?: FarmFromMode, toMode?: FarmToMode) => [
      this.dai2weth(fromMode, FarmToMode.INTERNAL) as StepGenerator,
      this.wellAddLiquidity(well, sdk.tokens.WETH, account, FarmFromMode.INTERNAL, toMode)
    ];

    this.wellWethBean = (fromToken: ERC20Token, toToken: ERC20Token, account: string, from?: FarmFromMode, to?: FarmToMode) => {
      const WELL_ADDRESS = sdk.addresses.BEANWETH_WELL.get(sdk.chainId);
      const result = [];

      // If the TO mode is INTERNAL that means this is not the last step of a swap/workflow.
      // We must transfer result of the swap back to User's INTERNAL balance on Beanstalk.
      // This means setting the swap recipient to PIPELINE, have PIPELINE approve Beanstalk to spend
      // the output token, then transfer the output token from PIPELINE's external balance to USER's internal balance
      const transferBack = to === FarmToMode.INTERNAL;

      // Transfer input token to PIPELINE (via Beanstalk, so a beanstalk approval will be required, but
      // that is a separate transaction, not part of this workflow)
      const transfer = new sdk.farm.actions.TransferToken(fromToken.address, sdk.contracts.pipeline.address, from, FarmToMode.EXTERNAL);

      // This transfers the output token back to Beanstalk, from PIPELINE. Used when transferBack == true
      const transferToBeanstalk = new sdk.farm.actions.TransferToken(toToken.address, account, FarmFromMode.EXTERNAL, FarmToMode.INTERNAL);

      // This approves the transferToBeanstalk operation. Used when transferBack == true
      const approveBack = new sdk.farm.actions.ApproveERC20(toToken, sdk.contracts.beanstalk.address);

      // When transferBack is true, we tell Wells to send the swap result to PIEPLINE, otherwise
      // send it directly to the user
      const recipient = transferBack ? sdk.contracts.pipeline.address : account;

      // Set up the AdvancedPipe workflow that will call Wells via PIPELINE
      const advancedPipe = sdk.farm.createAdvancedPipe("Pipeline");

      // Approve WELL to spend PIPELINE's input token
      const approve = new sdk.farm.actions.ApproveERC20(fromToken, WELL_ADDRESS);

      // Swap opration executed on WELL, by PIPELINE
      const swap = new sdk.farm.actions.WellSwap(WELL_ADDRESS, fromToken, toToken, recipient);

      // Compose the steps
      advancedPipe.add(approve);
      advancedPipe.add(swap, { tag: "swap" });
      if (transferBack) {
        advancedPipe.add(approveBack);
        advancedPipe.add(transferToBeanstalk);
      }

      result.push(transfer);
      result.push(advancedPipe);

      return result;
    };

    this.wellAddLiquidity = (well: BasinWell, tokenIn: ERC20Token, account: string, from?: FarmFromMode, to?: FarmToMode) => {
      const result = [];
      const advancedPipe = sdk.farm.createAdvancedPipe("pipelineDeposit");

      const transferBack = to === FarmToMode.INTERNAL;
      const recipient = transferBack ? sdk.contracts.pipeline.address : account;

      // Transfer input token to WELL
      const transfer = new sdk.farm.actions.TransferToken(tokenIn.address, well.address, from, FarmToMode.EXTERNAL);

      // Call sync on WELL
      const addLiquidity = new sdk.farm.actions.WellSync(well, tokenIn, recipient);

      // This approves the transferToBeanstalk operation.
      const approveClipboard = {
        tag: "amountToDeposit", 
        copySlot: 0, 
        pasteSlot: 1
      }
      const approveBack = new sdk.farm.actions.ApproveERC20(well.lpToken, sdk.contracts.beanstalk.address, approveClipboard);

      // Transfers the output token back to Beanstalk, from PIPELINE.
      const transferClipboard = {
        tag: "amountToDeposit", 
        copySlot: 0, 
        pasteSlot: 2
      }
      const transferToBeanstalk = new sdk.farm.actions.TransferToken(well.address, account, FarmFromMode.EXTERNAL, FarmToMode.INTERNAL, transferClipboard);

      result.push(transfer);
      advancedPipe.add(addLiquidity, { tag: "amountToDeposit" });
      if (transferBack) {
        advancedPipe.add(approveBack);
        advancedPipe.add(transferToBeanstalk);
      }

      result.push(advancedPipe);

      return result;
    };
  }
}
