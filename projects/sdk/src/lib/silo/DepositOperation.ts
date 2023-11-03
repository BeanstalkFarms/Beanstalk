import { ContractTransaction } from "ethers";
import { Router, Route } from "src/classes/Router";
import { Token } from "src/classes/Token";
import { ActionType } from "src/constants/actions";
import { TokenValue } from "src/TokenValue";
import { BeanstalkSDK } from "../BeanstalkSDK";
import { AdvancedFarmWorkflow, FarmFromMode, FarmToMode, FarmWorkflow } from "../farm";

export class DepositOperation {
  static sdk: BeanstalkSDK;
  readonly targetToken: Token;
  readonly account: string;
  fromMode: FarmFromMode = FarmFromMode.INTERNAL_EXTERNAL;
  inputToken: Token;
  inputAmount: TokenValue;
  readonly router: Router;
  workflow: AdvancedFarmWorkflow|FarmWorkflow<{ slippage: number } & Record<string, any>>;
  lastAmountIn: TokenValue;
  route: Route;

  constructor(sdk: BeanstalkSDK, router: Router, targetToken: Token, account: string) {
    if (!sdk.tokens.siloWhitelist.has(targetToken)) throw new Error(`Cannot deposit ${targetToken.symbol}, not on whitelist.`);

    DepositOperation.sdk = sdk;
    this.router = router;
    this.targetToken = targetToken;
    this.account = account;
  }

  setInputToken(token: Token, fromMode: FarmFromMode = FarmFromMode.INTERNAL_EXTERNAL) {
    this.fromMode = fromMode;
    if (!this.inputToken || !this.inputToken.equals(token)) {
      this.inputToken = token;
      this.buildWorkflow();
    }
  }

  buildWorkflow() {
    this.route = this.router.getRoute(this.inputToken.symbol, `${this.targetToken.symbol}:SILO`);

    if (this.inputToken.symbol !== "BEANETH" && this.targetToken.symbol === "BEANETH") {
      this.workflow = DepositOperation.sdk.farm.createAdvancedFarm(`Deposit`);
    } else {
      this.workflow = DepositOperation.sdk.farm.create(`Deposit`);
    }

    for (let i = 0; i < this.route.length; i++) {
      let from, to;
      // First leg, use (USER-DEFINED, INTERNAL)
      if (i == 0) {
        from = this.fromMode;
        to = FarmToMode.INTERNAL;
      }
      // Last leg, ie Deposit() step, use (INTERNAL_TOLERANT, not-used)
      else if (i == this.route.length - 1) {
        from = FarmFromMode.INTERNAL_TOLERANT;
        to = FarmToMode.EXTERNAL; // Dummy value, not used in the Deposit() step
      }
      // In-between legs, use (INTERNAL_TOLERANT, INTERNAL)
      else {
        from = FarmFromMode.INTERNAL_TOLERANT;
        to = FarmToMode.INTERNAL;
      }
      this.workflow.add(this.route.getStep(i).build(this.account, from, to));
    }
  }

  getGraph() {
    console.log(this.router.getGraphCode());
  }

  getSimplePath() {
    console.log(this.workflow.summarizeSteps());
  }

  async getSummary() {
    const summary = [];
    const fromToken = this.inputToken;
    const toToken = this.targetToken;
    const steps = this.workflow.summarizeSteps();
    const depositStep = steps.find((s) => s.name === "deposit");
    if (!depositStep) throw new Error("Deposit step not found");

    // If there's more than one step, that means we swaped (or added liquidity which
    // we count as a swap here)
    if (steps.length > 1) {
      summary.push({
        type: ActionType.SWAP,
        tokenIn: fromToken,
        tokenOut: toToken,
        amountIn: this.lastAmountIn,
        amountOut: toToken.fromBlockchain(depositStep.amountOut)
      });
    }

    const depositBDV = await DepositOperation.sdk.bean.getBDV(toToken, toToken.fromBlockchain(depositStep.amountOut));

    summary.push({
      type: ActionType.DEPOSIT,
      amount: toToken.fromBlockchain(depositStep.amountOut),
      token: toToken
    });
    summary.push({
      type: ActionType.UPDATE_SILO_REWARDS,
      stalk: toToken.getStalk(depositBDV),
      seeds: toToken.getSeeds(depositBDV)
    });

    return summary;
  }

  async estimate(amountIn: TokenValue): Promise<TokenValue> {
    this.validate();

    this.lastAmountIn = amountIn;
    const est = await this.workflow.estimate(amountIn);

    return this.targetToken.fromBlockchain(est);
  }

  async execute(amountIn: TokenValue, slippage: number): Promise<ContractTransaction> {
    this.validate();

    this.lastAmountIn = amountIn;
    return this.workflow.execute(amountIn, { slippage });
  }

  validate() {
    if (!this.inputToken) throw new Error("inputToken not set");
    if (this.workflow.length === 0) throw new Error("No available route in workflow");
  }
}
