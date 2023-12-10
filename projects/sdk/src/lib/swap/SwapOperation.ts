import { ContractTransaction, ethers, BigNumber, CallOverrides } from "ethers";
import { Workflow } from "src/classes/Workflow";
import { TokenValue } from "src/TokenValue";
import { Token } from "src/classes/Token";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { Route } from "src/classes/Router";
import { AdvancedFarmWorkflow } from "../farm";

type PathSegment = {
  from: string;
  to: string;
};

export class SwapOperation {
  private static sdk: BeanstalkSDK;

  constructor(
    sdk: BeanstalkSDK,
    readonly tokenIn: Token,
    readonly tokenOut: Token,
    private readonly workflow: AdvancedFarmWorkflow|Workflow,
    private readonly route: Route
  ) {
    SwapOperation.sdk = sdk;
    sdk.debug(`new SwapOperation(): ${this.getDisplay()}`);
  }

  public isValid(): boolean {
    return this.workflow.length > 0;
  }

  getSimplePath(): string[] {
    return this.route.toArray();
  }

  getDisplay(separator?: string) {
    return this.route.toString(separator);
  }

  // TODO: Convert to TokenValue
  /**
   * Estimate what the operation would output given this amountIn is the input.
   * For ex, if we are trading ETH -> BEAN, and you want to spend exactly 5 ETH, estimate()
   * would tell how much BEAN you'd receive for 5 ETH
   * @param amountIn Amount to send to workflow as input for estimation
   * @returns Promise of BigNumber
   */
  async estimate(amountIn: BigNumber | TokenValue): Promise<TokenValue> {
    if (!this.isValid()) throw new Error("Invalid swap configuration");

    const est = await this.workflow.estimate(amountIn);
    return this.tokenOut.fromBlockchain(est);
  }

  async estimateGas(amountIn: BigNumber | TokenValue, slippage: number): Promise<TokenValue> {
    const gas = await this.workflow.estimateGas(amountIn, { slippage });
    return TokenValue.fromBlockchain(gas, 0);
  }

  /**
   * Estimate the min amount to input to the workflow to receive the desiredAmountOut output
   * For ex, if we are trading ETH -> Bean, and I want exactly 500 BEAN, estimateReversed()
   * tell me how much ETH will result in 500 BEAN
   * @param desiredAmountOut The end amount you want the workflow to output
   * @returns Promise of BigNumber
   */
  async estimateReversed(desiredAmountOut: BigNumber | TokenValue): Promise<TokenValue> {
    if (!this.isValid()) throw new Error("Invalid swap configuration");
    const est = await this.workflow.estimateReversed(desiredAmountOut);
    return this.tokenIn.fromBlockchain(est);
  }

  /**
   *
   * @param amountIn Amount to use as first input to Work
   * @param slippage A human readable percent value. Ex: 0.1 would mean 0.1% slippage
   * @returns Promise of a Transaction
   */
  async execute(amountIn: BigNumber | TokenValue, slippage: number, overrides: CallOverrides = {}): Promise<ContractTransaction> {
    if (!this.isValid()) throw new Error("Invalid swap configuration");

    return this.workflow.execute(amountIn, { slippage }, overrides);
  }

  getFarm() {
    return this.workflow;
  }
}
