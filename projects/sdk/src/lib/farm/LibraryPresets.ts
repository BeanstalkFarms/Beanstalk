import { ethers } from "ethers";
import { ERC20Token, NativeToken } from "src/classes/Token";
import { BasicPreparedResult, RunContext, StepGenerator } from "src/classes/Workflow";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { FarmFromMode, FarmToMode } from "../farm/types";
import { EIP2612PermitMessage, SignedPermit } from "../permit";
import { Exchange, ExchangeUnderlying } from "./actions/index";

export type ActionBuilder = (
  fromMode?: FarmFromMode,
  toMode?: FarmToMode
) => StepGenerator<BasicPreparedResult> | StepGenerator<BasicPreparedResult>[];

export class LibraryPresets {
  static sdk: BeanstalkSDK;
  public readonly weth2usdt: ActionBuilder;
  public readonly usdt2bean: ActionBuilder;
  public readonly usdt2weth: ActionBuilder;
  public readonly bean2usdt: ActionBuilder;
  public readonly weth2bean: ActionBuilder;
  public readonly bean2weth: ActionBuilder;
  public readonly well_weth2bean;

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

    ///////// BEAN <> USDT ///////////
    this.usdt2bean = (fromMode?: FarmFromMode, toMode?: FarmToMode) =>
      new ExchangeUnderlying(sdk.contracts.curve.pools.beanCrv3.address, sdk.tokens.USDT, sdk.tokens.BEAN, fromMode, toMode);

    this.bean2usdt = (fromMode?: FarmFromMode, toMode?: FarmToMode) =>
      new ExchangeUnderlying(sdk.contracts.curve.pools.beanCrv3.address, sdk.tokens.BEAN, sdk.tokens.USDT, fromMode, toMode);

    //////// WETH <> BEAN
    this.weth2bean = (fromMode?: FarmFromMode, toMode?: FarmToMode) => [
      this.weth2usdt(fromMode, FarmToMode.INTERNAL) as StepGenerator,
      this.usdt2bean(FarmFromMode.INTERNAL, toMode) as StepGenerator
    ];
    this.bean2weth = (fromMode?: FarmFromMode, toMode?: FarmToMode) => [
      this.bean2usdt(fromMode, FarmToMode.INTERNAL) as StepGenerator,
      this.usdt2weth(FarmFromMode.INTERNAL, toMode) as StepGenerator
    ];

    this.well_weth2bean = (account: string, from?: FarmFromMode, to?: FarmToMode) => {
      const WELL_ADDRESS = sdk.addresses.BEANWETH_WELL.get(sdk.chainId);
      const result = [];

      // If the TO mode is INTERNAL that means this is not the last step of a swap/workflow.
      // We must transfer result of the swap back to User's INTERNAL balance on Beanstalk.
      // This means setting the swap recipient to PIPELINE, have PIPELINE approve Beanstalk to spend
      // the output token, then transfer the output token from PIPELINE's external balance to USER's internal balance
      const transferBack = to === FarmToMode.INTERNAL;

      // Transfer input token to PIPELINE (via Beanstalk, so a beanstalk approval will be required, but
      // that is a separate transaction, not part of this workflow)
      const transfer = new sdk.farm.actions.TransferToken(
        sdk.tokens.WETH.address,
        sdk.contracts.pipeline.address,
        from,
        FarmToMode.EXTERNAL
      );

      // This transfers the output token back to Beanstalk, from PIPELINE. Used when transferBack == true
      const transferToBeanstalk = new sdk.farm.actions.TransferToken(
        sdk.tokens.BEAN.address,
        account,
        FarmFromMode.EXTERNAL,
        FarmToMode.INTERNAL
      );

      // This approves the transferToBeanstalk operation. Used when transferBack == true
      const approveBack = new sdk.farm.actions.ApproveERC20(sdk.tokens.BEAN, sdk.contracts.beanstalk.address);

      // When transferBack is true, we tell Wells to send the swap result to PIEPLINE, otherwise
      // send it directly to the user
      const recipient = transferBack ? sdk.contracts.pipeline.address : account;

      // Set up the AdvancedPipe workflow that will call Wells via PIPELINE
      const advancedPipe = sdk.farm.createAdvancedPipe("Pipeline");

      // Approve WELL to spend PIPELINE's input token
      const approve = new sdk.farm.actions.ApproveERC20(sdk.tokens.WETH, WELL_ADDRESS);

      // Swap opration executed on WELL, by PIPELINE
      const swap = new sdk.farm.actions.WellSwap(WELL_ADDRESS, sdk.tokens.WETH, sdk.tokens.BEAN, recipient);

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
  }
}
