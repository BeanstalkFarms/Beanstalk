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

export type QuotePrepareResult = {
  doSwap: (overrides?: TxOverrides) => Promise<ContractTransaction>;
  doApproval?: (overrides?: TxOverrides) => Promise<ContractTransaction>;
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
    let prevQuoteGasEstimate: TokenValue = TokenValue.ZERO;
    for (const step of steps) {
      const { quote, quoteWithSlippage, quoteGasEstimate } = await step.quote(
        isMultiReverse ? prevQuoteWSlippage : prevQuote,
        direction,
        slippage,
        recipient
      );
      prevQuote = quote;
      prevQuoteWSlippage = quoteWithSlippage;
      prevQuoteGasEstimate = prevQuoteGasEstimate.add(quoteGasEstimate);
    }

    this.fullQuote = prevQuote;
    const { doApproval, doSwap } = await this.prepare(recipient); // TODO: Add deadline

    return {
      amount: prevQuote,
      amountWithSlippage: prevQuoteWSlippage,
      gas: prevQuoteGasEstimate,
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

    const doSwap = (overrides: TxOverrides = {}): Promise<ContractTransaction> => {
      // If starting with ETH and this is a single swap, it means we're just wrapping it
      // so we can infer that `parameters[0]` are the overrides which include {value} returned
      // by step.swapSingle(). We combine with user provided overrides
      if (this.fromToken.symbol === "ETH") {
        parameters[0] = { ...overrides, ...(parameters[0] as Object) };
      } else {
        parameters.push(overrides);
      }
      // @ts-ignore
      return contract[method](...parameters);
    };

    const amountToSpend = this.direction === Direction.FORWARD ? this.amountUsedForQuote : step.quoteResultWithSlippage!;

    const doApproval = await this.getApproval(step.fromToken, amountToSpend, contract.address, recipient);

    return { doApproval, doSwap };
  }

  private async prepareMulti(recipient: string): Promise<QuotePrepareResult> {
    const direction = Direction.FORWARD;

    // Should never happen but sanity check
    if (this.direction !== direction) throw new Error("Direction of last quote does not match expected direction of swap");
    const steps = [...this.steps];

    // If we start with ETH, remove the first step to wrap it, that only works for a single-step flow. We will build a custom flow here
    // to handle wrapping ETH as part of a pipeline call.
    if (this.fromToken.symbol === "ETH") {
      steps.shift();
    }

    const shiftOps = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const nextRecipient = steps[i + 1]?.well.contract.address ?? recipient;

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
    }
    // Unwrap ETH flow
    else if (this.toToken.symbol === "ETH") {
      throw new Error("Cannot swap to ETH yet");
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
    }

    return {
      doSwap,
      doApproval
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

    const desiredAmount = this.amountUsedForQuote; // Amount desired
    const operations = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const nextStep = steps[i + 1] || null;
      const nextRecipient = i === steps.length - 1 ? recipient : pipelineAddress;

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
    }
    // Unwrap ETH flow
    else if (this.toToken.symbol === "ETH") {
      throw new Error("Cannot swap to ETH yet");
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
    }

    const doApproval = await this.getApproval(this.fromToken, startingAmount, this.depot.address, recipient);

    return {
      doSwap,
      doApproval
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
