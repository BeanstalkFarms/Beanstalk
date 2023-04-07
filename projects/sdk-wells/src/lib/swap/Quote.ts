import { Token, TokenValue } from "@beanstalk/sdk-core";
import { Route } from "src/lib/routing";
import { Direction, SwapStep } from "src/lib/swap/SwapStep";
import { Depot, Depot__factory, ERC20 } from "src/constants/generated";
import { addresses } from "src/constants/addresses";
import { WellsSDK } from "src/lib/WellsSDK";
import { TxOverrides } from "src/lib/Well";
import { ContractTransaction } from "ethers";
import { deadlineSecondsToBlockchain } from "src/lib/utils";

const DEFAULT_DEADLINE = 60 * 5; // in seconds

export type QuotePrepareResult = {
  doSwap: () => Promise<ContractTransaction>;
  doApproval?: () => Promise<ContractTransaction>;
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

  constructor(sdk: WellsSDK, fromToken: Token, toToken: Token, route: Route, account: string) {
    if (route.length < 1) throw new Error("Cannot build Quote when there is no viable Route");

    this.sdk = sdk;
    this.fromToken = fromToken;
    this.toToken = toToken;
    this.route = route;
    this.account = account;

    for (const { from, to, well } of this.route) {
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
  async quoteForward(amountIn: number | TokenValue, slippage: number) {
    if (typeof amountIn == "number") {
      amountIn = this.fromToken.amount(amountIn);
    }
    return this.doQuote(amountIn, Direction.FORWARD, slippage);
  }

  /**
   * Find out how many `fromTokens` you need to spend in order to receive `amountOut` of `toToken`
   *
   * @param amountOut The amount of `toToken` to use for a quote.
   * @returns The amount of `fromToken` you will need to spend to receive `amountOut` of `toToken`
   */
  async quoteReverse(amountOut: number | TokenValue, slippage: number) {
    if (typeof amountOut == "number") {
      amountOut = this.toToken.amount(amountOut);
    }
    return this.doQuote(amountOut, Direction.REVERSE, slippage);
  }

  private async doQuote(amount: TokenValue, direction: Direction, slippage: number): Promise<TokenValue> {
    if (!slippage) throw new Error("Must supply slippage when doing a quote");
    this.amountUsedForQuote = amount;
    this.direction = direction;
    this.slippage = slippage;

    const fwd = direction === Direction.FORWARD;
    const steps = fwd ? this.steps : [...this.steps].reverse();
    const isMultiReverse = !fwd && steps.length > 1;
    console.log("Is Multi Reverse Quote: ", isMultiReverse);

    let prevQuote: TokenValue = amount;
    let prevQuoteWSlippage: TokenValue = amount;
    for (const step of steps) {
      console.log("Quote Step:", step.fromToken.symbol, " -> ", step.toToken.symbol);
      const { quote, quoteWithSlippage } = await step.quote(isMultiReverse ? prevQuoteWSlippage : prevQuote, direction, slippage);

      if (fwd) {
        console.log(
          `${prevQuote.toHuman()} ${step.fromToken.symbol} will result in ${quote.toHuman()} (${quoteWithSlippage.toHuman()}) ${
            step.toToken.symbol
          }`
        );
      } else {
        console.log(
          `${quote.toHuman()}(${quoteWithSlippage.toHuman()}) ${step.fromToken.symbol} needed to buy ${(isMultiReverse
            ? prevQuoteWSlippage
            : prevQuote
          ).toHuman()} ${step.toToken.symbol}`
        );
      }
      prevQuote = quote;
      prevQuoteWSlippage = quoteWithSlippage;
    }

    this.fullQuote = prevQuote;

    return prevQuote;
  }

  async prepare(recipient: string, deadline: number = DEFAULT_DEADLINE, overrides?: TxOverrides): Promise<QuotePrepareResult> {
    if (!this.fullQuote || !this.amountUsedForQuote || this.direction == undefined) {
      throw new Error("Cannot prepare. You must run .quoteForward() or .quoteReverse() first");
    }
    const fwd = this.direction === Direction.FORWARD;
    const blockChainDeadline = deadlineSecondsToBlockchain(deadline);

    if (this.route.length === 1) {
      return this.prepareSingle(recipient, blockChainDeadline, overrides);
    } else {
      return fwd
        ? this.prepareMulti(recipient, blockChainDeadline, overrides)
        : this.prepareMultiReverse(recipient, blockChainDeadline, overrides);
    }
  }

  private async prepareSingle(recipient: string, deadline: number, overrides?: TxOverrides) {
    const step = this.steps[0];
    const { contract, method, parameters } = step.swapSingle(this.amountUsedForQuote, step.quoteResultWithSlippage!, recipient, deadline);
    parameters.push(overrides ?? {});

    // @ts-ignore
    const doSwap = (): Promise<ContractTransaction> => contract[method](...parameters);

    const amountToSpend = this.direction === Direction.FORWARD ? this.amountUsedForQuote : step.quoteResultWithSlippage!;

    const doApproval = await this.getApproval(step.fromToken, amountToSpend, contract.address, recipient);

    return { doApproval, doSwap };
  }

  private async prepareMulti(recipient: string, deadline: number, overrides?: TxOverrides): Promise<QuotePrepareResult> {
    const direction = Direction.FORWARD;

    // Should never happen but sanity check
    if (this.direction !== direction) throw new Error("Direction of last quote does not match expected direction of swap");

    const steps = this.steps;

    const shiftOps = [];

    const transfer = this.depot.interface.encodeFunctionData("transferToken", [
      this.fromToken.address,
      this.steps[0].well.address,
      this.amountUsedForQuote.toBigNumber(),
      0,
      0
    ]);

    for (let i = 0; i < steps.length; i++) {
      const step = this.steps[i];
      const nextRecipient = this.steps[i + 1]?.well.contract.address ?? recipient;

      const { contract, method, parameters } = step.shift(nextRecipient, step.quoteResultWithSlippage!);

      const shiftOp = {
        target: contract.address,
        // @ts-ignore
        callData: contract.interface.encodeFunctionData(method, parameters),
        clipboard: "0x0000000000000000000000000000000000000000000000000000000000000000" // Clipboard.encode([])
      };

      shiftOps.push(shiftOp);
    }

    const doApproval = await this.getApproval(this.fromToken, this.amountUsedForQuote, this.depot.address, recipient);
    const pipe = this.depot.interface.encodeFunctionData("advancedPipe", [shiftOps, 0]);
    return {
      doSwap: (): Promise<ContractTransaction> => this.depot.farm([transfer, pipe]),
      doApproval
    };
  }

  private async prepareMultiReverse(recipient: string, deadline: number, overrides?: TxOverrides): Promise<QuotePrepareResult> {
    const direction = Direction.REVERSE;

    // Should never happen but sanity check
    if (this.direction !== direction) throw new Error("Direction of last quote does not match expected direction of swap");

    const pipelineAddress = "0xb1be0000bfdcddc92a8290202830c4ef689dceaa";
    const steps = this.steps;

    const desiredAmount = this.amountUsedForQuote; // Amount desired
    const operations = [];

    for (let i = 0; i < steps.length; i++) {
      const step = this.steps[i];
      const nextStep = this.steps[i + 1] || null;
      // console.log("Step:", step.fromToken.symbol, " -> ", step.toToken.symbol);
      // console.log(`quote: ${step.quoteResult?.toHuman()} ${step.fromToken.symbol} needed to buy ${step.quoteInput?.toHuman()} ${step.toToken.symbol}`);

      const nextRecipient = i === steps.length - 1 ? recipient : pipelineAddress;

      const amountWithSlippage = step.quoteResultWithSlippage!;
      const maxAmountOut = amountWithSlippage;
      const currentDesiredAmount = nextStep ? nextStep.quoteResultWithSlippage! : desiredAmount;
      const { contract, method, parameters } = step.swapTo(nextRecipient, maxAmountOut, currentDesiredAmount, deadline);

      operations.push({
        target: step.fromToken.address,
        callData: step.fromToken
          .getContract()!
          .interface.encodeFunctionData("approve", [step.well.address, amountWithSlippage.toBigNumber()]),
        clipboard: "0x0000000000000000000000000000000000000000000000000000000000000000" // Clipboard.encode([])
      });
      console.log("Approval:", {
        target: step.fromToken.address,
        callData: `approve(${step.well.address}, ${amountWithSlippage.toBigNumber()})`
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

    const transfer = this.depot.interface.encodeFunctionData("transferToken", [
      this.fromToken.address,
      pipelineAddress,
      startingAmount.toBigNumber(),
      0,
      0
    ]);

    const doApproval = await this.getApproval(this.fromToken, startingAmount, this.depot.address, recipient);

    const pipe = this.depot.interface.encodeFunctionData("advancedPipe", [operations, 0]);
    return {
      doSwap: (): Promise<ContractTransaction> => this.depot.farm([transfer, pipe]),
      doApproval
    };
  }

  async getApproval(token: Token, amount: TokenValue, spender: string, account: string) {
    const allowance = await token.getAllowance(account, spender);

    if (allowance && allowance.gte(amount)) return;

    const doApproval = () => {
      console.log(`${token.symbol}.approve(${spender}, ${amount.toHuman()})`);
      return token.approve(spender, amount);
    };

    return doApproval;
  }
}
