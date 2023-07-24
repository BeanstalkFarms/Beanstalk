import { Token, TokenValue } from "@beanstalk/sdk-core";
import { Route } from "src/lib/routing";
import { Direction, SwapStep } from "src/lib/swap/SwapStep";
import { Depot, Depot__factory, ERC20, WETH9, WETH9__factory } from "src/constants/generated";
import { addresses } from "src/constants/addresses";
import { WellsSDK } from "src/lib/WellsSDK";
import { TxOverrides } from "src/lib/Well";
import { ContractTransaction } from "ethers";
import { deadlineSecondsToBlockchain } from "src/lib/utils";
import { WrapEthStep } from "./WrapStep";
import { Clipboard } from "src/lib/clipboard/clipboard";
import { UnWrapEthStep } from "./UnWrapStep";

const DEFAULT_DEADLINE = 60 * 5; // in seconds
const PIPELINE_ADDRESS = addresses.PIPELINE.get(1);

export type QuotePrepareResult = {
  doSwap: (overrides?: TxOverrides) => Promise<ContractTransaction>;
  doApproval?: (overrides?: TxOverrides) => Promise<ContractTransaction>;
  doGasEstimate: (overrides?: TxOverrides) => Promise<TokenValue>;
};

export type QuoteResult = {
  amount: TokenValue;
  amountWithSlippage: TokenValue;
  gas: TokenValue;
  doSwap: (overrides?: TxOverrides) => Promise<ContractTransaction>;
  doApproval?: (overrides?: TxOverrides) => Promise<ContractTransaction>;
};

export class Quote {
  private readonly sdk: WellsSDK;
  private readonly depot: Depot;

  fromToken: Token;
  toToken: Token;
  route: Route;
  account: string;
  steps: SwapStep[] = [];
  amountUsedForQuote: TokenValue;
  direction: Direction;
  // fullQuote is the expected end token given zero slippage. We calculate
  // the actual slippage against this, instead of at each step (which we do anyway for quoting)
  fullQuote: TokenValue | undefined;
  slippage: number;
  weth9: WETH9;
  debug: boolean = false;

  constructor(sdk: WellsSDK, fromToken: Token, toToken: Token, route: Route, account: string) {
    if (route.length < 1) throw new Error("Cannot build Quote when there is no viable Route");

    this.sdk = sdk;
    this.fromToken = fromToken;
    this.toToken = toToken;
    this.route = route;
    this.account = account;

    this.weth9 = WETH9__factory.connect(addresses.WETH9.get(this.sdk.chainId), this.sdk.providerOrSigner);

    for (const { from, to, well } of this.route) {
      if (from.symbol === "ETH" && to.symbol === "WETH") {
        this.steps.push(new WrapEthStep(sdk, this.weth9, from, to));
        continue;
      }

      if (from.symbol === "WETH" && to.symbol === "ETH") {
        this.steps.push(new UnWrapEthStep(sdk, this.weth9, from, to));
        continue;
      }

      this.steps.push(new SwapStep(well, from, to));
    }

    this.depot = Depot__factory.connect(addresses.DEPOT.get(this.sdk.chainId), this.sdk.providerOrSigner);
  }

  /**
   * Find out how many `toToken`s you will receive for spending `amountIn` of `fromToken`
   *
   * @param amountIn The amount of `fromToken` to use for a quote.
   * @returns The amount of `toToken` you will receive in exchange for `amountIn` of `fromToken`
   */
  async quoteForward(amountIn: number | TokenValue, recipient: string, slippage: number): Promise<QuoteResult> {
    if (typeof amountIn == "number") {
      amountIn = this.fromToken.amount(amountIn);
    }
    return this.doQuote(amountIn, Direction.FORWARD, recipient, slippage);
  }

  /**
   * Find out how many `fromTokens` you need to spend in order to receive `amountOut` of `toToken`
   *
   * @param amountOut The amount of `toToken` to use for a quote.
   * @returns The amount of `fromToken` you will need to spend to receive `amountOut` of `toToken`
   */
  async quoteReverse(amountOut: number | TokenValue, recipient: string, slippage: number): Promise<QuoteResult> {
    if (typeof amountOut == "number") {
      amountOut = this.toToken.amount(amountOut);
    }
    return this.doQuote(amountOut, Direction.REVERSE, recipient, slippage);
  }

  private async doQuote(amount: TokenValue, direction: Direction, recipient: string, slippage: number): Promise<QuoteResult> {
    if (!slippage) throw new Error("Must supply slippage when doing a quote");

    this.amountUsedForQuote = amount;
    this.direction = direction;
    this.slippage = slippage;

    const fwd = direction === Direction.FORWARD;
    const steps = fwd ? this.steps : [...this.steps].reverse();
    const isMultiReverse = !fwd && steps.length > 1;

    let prevQuote: TokenValue = amount;
    let prevQuoteWSlippage: TokenValue = amount;
    for (const step of steps) {
      const { quote, quoteWithSlippage } = await step.quote(
        isMultiReverse ? prevQuoteWSlippage : prevQuote,
        direction,
        slippage,
        recipient
      );
      prevQuote = quote;
      prevQuoteWSlippage = quoteWithSlippage;
    }

    this.fullQuote = prevQuote;
    const { doApproval, doSwap, doGasEstimate } = await this.prepare(recipient); // TODO: Add deadline

    let gas = TokenValue.ZERO;
    try {
      gas = await doGasEstimate();
    } catch (err) {
      // Ignored. This will fail in most cases when doing a gas estimate and the user has not done approvals yet or has insufficient balance
    }
    return {
      amount: prevQuote,
      amountWithSlippage: prevQuoteWSlippage,
      gas,
      doApproval,
      doSwap
    };
  }

  async prepare(recipient: string, deadline: number = DEFAULT_DEADLINE, overrides?: TxOverrides): Promise<QuotePrepareResult> {
    if (!this.fullQuote || !this.amountUsedForQuote || this.direction == undefined) {
      throw new Error("Cannot prepare. You must run .quoteForward() or .quoteReverse() first");
    }
    const fwd = this.direction === Direction.FORWARD;
    const blockChainDeadline = deadlineSecondsToBlockchain(deadline);

    if (this.route.length === 1) {
      return this.prepareSingle(recipient, blockChainDeadline);
    } else {
      return fwd ? this.prepareMulti(recipient) : this.prepareMultiReverse(recipient, blockChainDeadline);
    }
  }

  private async prepareSingle(recipient: string, deadline: number) {
    const step = this.steps[0];
    const { contract, method, parameters } = step.swapSingle(this.amountUsedForQuote, step.quoteResultWithSlippage!, recipient, deadline);

    const getParameters = (overrides: TxOverrides = {}) => {
      // If starting with ETH and this is a single swap, it means we're just wrapping it
      // so we can infer that `parameters[0]` are the overrides which include {value} returned
      // by step.swapSingle(). We combine with user provided overrides
      const paramCopy = [...parameters];
      if (this.fromToken.symbol === "ETH") {
        paramCopy[0] = { ...overrides, ...(paramCopy[0] as Object) };
      } else {
        paramCopy.push(overrides);
      }

      return paramCopy;
    };

    // @ts-ignore
    const doSwap = (overrides?: TxOverrides): Promise<ContractTransaction> => contract[method](...getParameters(overrides));
    const doGasEstimate = async (overrides?: TxOverrides): Promise<TokenValue> => {
      // @ts-ignore
      const gas = await contract.estimateGas[method](...getParameters(overrides));
      return TokenValue.fromBlockchain(gas, 0);
    };

    const amountToSpend = this.direction === Direction.FORWARD ? this.amountUsedForQuote : step.quoteResultWithSlippage!;

    const doApproval = await this.getApproval(step.fromToken, amountToSpend, contract.address, recipient);

    return { doApproval, doSwap, doGasEstimate };
  }

  private async prepareMulti(recipient: string): Promise<QuotePrepareResult> {
    const direction = Direction.FORWARD;

    // Should never happen but sanity check
    if (this.direction !== direction) throw new Error("Direction of last quote does not match expected direction of swap");
    const steps = [...this.steps];

    // If we start with ETH, remove the first step to wrap it, that only works for a single-step flow. We will build a custom flow here
    // to handle wrapping ETH as part of a pipeline call.
    // Similarly if it ends in ETH, remove it.
    if (this.fromToken.symbol === "ETH") {
      steps.shift();
    }
    if (this.toToken.symbol === "ETH") {
      steps.pop();
    }

    const shiftOps = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      let nextRecipient = steps[i + 1]?.well.contract.address ?? recipient;

      // If this is a swap that ends in ETH, we need to send the amount of the last swap (which should be WETH) to pipeline
      if (i === steps.length - 1 && this.toToken.symbol === "ETH") nextRecipient = PIPELINE_ADDRESS;

      const { contract, method, parameters } = step.swapMany(nextRecipient, step.quoteResultWithSlippage!);

      const shiftOp = {
        target: contract.address,
        // @ts-ignore
        callData: contract.interface.encodeFunctionData(method, parameters),
        clipboard: "0x0000000000000000000000000000000000000000000000000000000000000000" // Clipboard.encode([])
      };

      this.log(`Well: ${step.well.name}, Method: ${method}, Params: ${parameters}, Recipient: ${nextRecipient}`);

      shiftOps.push(shiftOp);
    }

    const doApproval = await this.getApproval(this.fromToken, this.amountUsedForQuote, this.depot.address, recipient);

    let doSwap;
    let doGasEstimate;
    let pipe: string;

    // Wrap ETH flow
    if (this.fromToken.symbol === "ETH") {
      const wrapEth = {
        target: this.weth9.address,
        callData: this.weth9.interface.encodeFunctionData("deposit"),
        clipboard: Clipboard.encode([], this.amountUsedForQuote.toBigNumber())
      };
      const wethTransfer = {
        target: this.weth9.address,
        callData: this.weth9.interface.encodeFunctionData("transfer", [steps[0].well.address, this.amountUsedForQuote.toBigNumber()]),
        clipboard: Clipboard.encode([])
      };

      pipe = this.depot.interface.encodeFunctionData("advancedPipe", [
        [wrapEth, wethTransfer, ...shiftOps],
        this.amountUsedForQuote.toBlockchain()
      ]);

      doSwap = (overrides: TxOverrides = {}): Promise<ContractTransaction> => {
        const overrideOptions = { ...overrides, value: this.amountUsedForQuote.toBigNumber() };
        return this.depot.farm([pipe], overrideOptions);
      };

      doGasEstimate = async (overrides: TxOverrides = {}): Promise<TokenValue> => {
        const overrideOptions = { ...overrides, value: this.amountUsedForQuote.toBigNumber() };
        const gas = await this.depot.estimateGas.farm([pipe], overrideOptions);
        return TokenValue.fromBlockchain(gas, 0);
      };
    }
    // Unwrap ETH flow
    else if (this.toToken.symbol === "ETH") {
      // Last step should be to swap to WETH
      const wethStep = steps[steps.length - 1];
      if (wethStep.toToken.symbol !== "WETH")
        throw new Error("Last step of multi-swap should have been a swap to WETH if the overall swap is for ETH.");

      const ethAmount = wethStep.quoteResultWithSlippage!;

      const transferToFirstWell = this.depot.interface.encodeFunctionData("transferToken", [
        this.fromToken.address,
        steps[0].well.address,
        this.amountUsedForQuote.toBigNumber(),
        0,
        0
      ]);

      const unwrapWeth = {
        target: this.weth9.address,
        callData: this.weth9.interface.encodeFunctionData("withdraw", [ethAmount.toBigNumber()]),
        clipboard: Clipboard.encode([])
      };

      const sendEth = {
        target: recipient,
        callData: "0x",
        clipboard: Clipboard.encode([], ethAmount.toBigNumber())
      };

      pipe = this.depot.interface.encodeFunctionData("advancedPipe", [[...shiftOps, unwrapWeth, sendEth], 0]);

      doSwap = (overrides: TxOverrides = {}): Promise<ContractTransaction> => {
        return this.depot.farm([transferToFirstWell, pipe], overrides);
      };

      doGasEstimate = async (overrides: TxOverrides = {}): Promise<TokenValue> => {
        const gas = await this.depot.estimateGas.farm([transferToFirstWell, pipe], overrides);
        return TokenValue.fromBlockchain(gas, 0);
      };
    }
    // Normal flow, no ETH involved
    else {
      const transferToFirstWell = this.depot.interface.encodeFunctionData("transferToken", [
        this.fromToken.address,
        steps[0].well.address,
        this.amountUsedForQuote.toBigNumber(),
        0,
        0
      ]);

      pipe = this.depot.interface.encodeFunctionData("advancedPipe", [shiftOps, 0]);

      doSwap = (overrides: TxOverrides = {}): Promise<ContractTransaction> => {
        return this.depot.farm([transferToFirstWell, pipe], overrides);
      };

      doGasEstimate = async (overrides: TxOverrides = {}): Promise<TokenValue> => {
        const gas = await this.depot.estimateGas.farm([transferToFirstWell, pipe], overrides);
        return TokenValue.fromBlockchain(gas, 0);
      };
    }

    return {
      doSwap,
      doApproval,
      doGasEstimate
    };
  }

  private async prepareMultiReverse(recipient: string, deadline: number): Promise<QuotePrepareResult> {
    const direction = Direction.REVERSE;

    // Should never happen but sanity check
    if (this.direction !== direction) throw new Error("Direction of last quote does not match expected direction of swap");

    const pipelineAddress = addresses.PIPELINE.get(this.sdk.chainId);
    const steps = [...this.steps];

    // If we start with ETH, remove the first step to wrap it, that only works for a single-step flow. We will build a custom flow here
    // to handle wrapping ETH as part of a pipeline call.
    if (this.fromToken.symbol === "ETH") {
      steps.shift();
    }
    if (this.toToken.symbol === "ETH") {
      steps.pop();
    }

    const desiredAmount = this.amountUsedForQuote; // Amount desired
    const operations = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const nextStep = steps[i + 1] || null;
      let nextRecipient = i === steps.length - 1 ? recipient : pipelineAddress;

      // If this is a swap that ends in ETH, we need to send the amount of the last swap (which should be WETH) to pipeline
      if (i === steps.length - 1 && this.toToken.symbol === "ETH") nextRecipient = PIPELINE_ADDRESS;

      const amountWithSlippage = step.quoteResultWithSlippage!;
      const maxAmountOut = amountWithSlippage;
      const currentDesiredAmount = nextStep ? nextStep.quoteResultWithSlippage! : desiredAmount;
      const { contract, method, parameters } = step.swapManyReverse(nextRecipient, maxAmountOut, currentDesiredAmount, deadline);

      operations.push({
        target: step.fromToken.address,
        callData: step.fromToken
          .getContract()!
          .interface.encodeFunctionData("approve", [step.well.address, amountWithSlippage.toBigNumber()]),
        clipboard: "0x0000000000000000000000000000000000000000000000000000000000000000" // Clipboard.encode([])
      });

      const swapToOp = {
        target: contract.address,
        // @ts-ignore
        callData: contract.interface.encodeFunctionData(method, parameters),
        clipboard: "0x0000000000000000000000000000000000000000000000000000000000000000" // Clipboard.encode([])
      };

      operations.push(swapToOp);
    }

    const startingAmount = steps[0].quoteResultWithSlippage!;

    let doSwap;
    let doGasEstimate;
    let pipe: string;

    // Wrap ETH flow
    if (this.fromToken.symbol === "ETH") {
      // startingAmount here is step[0], but after we did steps.shift(), so steps[0] is
      // really the WETH to whatever step. Therefore startingAmount is demoninated in WETH, but
      // that's okay since WETH and ETH have the same number of decimals, so we can use the same value
      const ethAmount = startingAmount;
      const wrapEth = {
        target: this.weth9.address,
        callData: this.weth9.interface.encodeFunctionData("deposit"),
        clipboard: Clipboard.encode([], ethAmount.toBigNumber())
      };

      pipe = this.depot.interface.encodeFunctionData("advancedPipe", [[wrapEth, ...operations], ethAmount.toBigNumber()]);

      doSwap = (overrides: TxOverrides = {}): Promise<ContractTransaction> => {
        const overrideOptions = { ...overrides, value: ethAmount.toBigNumber() };
        return this.depot.farm([pipe], overrideOptions);
      };

      doGasEstimate = async (overrides: TxOverrides = {}): Promise<TokenValue> => {
        const overrideOptions = { ...overrides, value: ethAmount.toBigNumber() };
        const gas = await this.depot.estimateGas.farm([pipe], overrideOptions);
        return TokenValue.fromBlockchain(gas, 0);
      };
    }
    // Unwrap ETH flow
    else if (this.toToken.symbol === "ETH") {
      // Last step should be to swap to WETH
      const wethStep = steps[steps.length - 1];
      if (wethStep.toToken.symbol !== "WETH")
        throw new Error("Last step of multi-swap should have been a swap to WETH if the overall swap is for ETH.");

      const ethAmount = wethStep.quoteInput!;

      const transferToPipeline = this.depot.interface.encodeFunctionData("transferToken", [
        this.fromToken.address,
        pipelineAddress,
        startingAmount.toBigNumber(),
        0,
        0
      ]);

      const unwrapWeth = {
        target: this.weth9.address,
        callData: this.weth9.interface.encodeFunctionData("withdraw", [ethAmount.toBigNumber()]),
        clipboard: Clipboard.encode([])
      };

      const sendEth = {
        target: recipient,
        callData: "0x",
        clipboard: Clipboard.encode([], ethAmount.toBigNumber())
      };

      pipe = this.depot.interface.encodeFunctionData("advancedPipe", [[...operations, unwrapWeth, sendEth], 0]);

      doSwap = (overrides: TxOverrides = {}): Promise<ContractTransaction> => {
        return this.depot.farm([transferToPipeline, pipe], overrides);
      };

      doGasEstimate = async (overrides: TxOverrides = {}): Promise<TokenValue> => {
        const gas = await this.depot.estimateGas.farm([transferToPipeline, pipe], overrides);
        return TokenValue.fromBlockchain(gas, 0);
      };
    }
    // Normal flow, no ETH involved
    else {
      const transferToPipeline = this.depot.interface.encodeFunctionData("transferToken", [
        this.fromToken.address,
        pipelineAddress,
        startingAmount.toBigNumber(),
        0,
        0
      ]);

      pipe = this.depot.interface.encodeFunctionData("advancedPipe", [operations, 0]);

      doSwap = (overrides: TxOverrides = {}): Promise<ContractTransaction> => {
        return this.depot.farm([transferToPipeline, pipe], overrides);
      };

      doGasEstimate = async (overrides: TxOverrides = {}): Promise<TokenValue> => {
        const gas = await this.depot.estimateGas.farm([transferToPipeline, pipe], overrides);
        return TokenValue.fromBlockchain(gas, 0);
      };
    }

    const doApproval = await this.getApproval(this.fromToken, startingAmount, this.depot.address, recipient);

    return {
      doSwap,
      doApproval,
      doGasEstimate
    };
  }

  async getApproval(token: Token, amount: TokenValue, spender: string, account: string) {
    if (!account) return;
    if (token.symbol === "ETH") return;

    const allowance = await token.getAllowance(account, spender);

    if (allowance && allowance.gte(amount)) return;

    const doApproval = () => {
      return token.approve(spender, amount);
    };

    return doApproval;
  }

  log(...args: any[]) {
    if (this.debug) {
      console.log("DEBUG:", ...args);
    }
  }
}
