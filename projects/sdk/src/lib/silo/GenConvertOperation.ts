import { BasinWell } from "src/classes/Pool";
import { BeanstalkSDK } from "../BeanstalkSDK";
import { ERC20Token } from "src/classes/Token";
import { AdvancedPipePreparedResult } from "../depot/pipe";

export class PipelineConvertOperation {
  static sdk: BeanstalkSDK;

  /**
   * The whitelisted token to convert from.
   */
  readonly inputToken: ERC20Token;

  /**
   * The whitelisted token to convert to.
   */
  target: ERC20Token;

  advancedPipeCalls: Required<AdvancedPipePreparedResult>[] = [];

  constructor(sdk: BeanstalkSDK, inputToken: ERC20Token) {
    PipelineConvertOperation.sdk = sdk;

    this.validateIsWhitelisted(inputToken);
    this.inputToken = inputToken;
  }

  setTarget(token: ERC20Token) {
    this.validateIsWhitelisted(token);
    this.target = token;
  }

  initialize(token: ERC20Token) {}

  private validateIsWhitelisted(token: ERC20Token) {
    if (!PipelineConvertOperation.sdk.tokens.isWhitelisted(token)) {
      throw new Error(`GenConvertOperation: Token ${token.symbol} is not whitelisted in the Silo.`);
    }
  }
}
