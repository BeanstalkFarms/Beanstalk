import {
  BeanstalkSDK,
  BeanSwapNodeQuote,
  BeanSwapOperation,
  Clipboard,
  ERC20Token,
  FarmFromMode,
  FarmToMode,
  NativeToken,
  StepGenerator,
  Token,
  TokenValue,
} from '@beanstalk/sdk';
import { ClaimAndDoX, FarmStep } from '~/lib/Txn/Interface';
import { makeLocalOnlyStep } from '~/lib/Txn/util';

/**
 * Deposit scenarios:
 *
 * SILO:BEAN
 * : ETH => WETH => USDT => BEAN (+ cBEAN) ==> SILO:BEAN
 * : BEAN (+ cBEAN) => SILO:BEAN
 *
 * SILO:BEAN_CRV3_LP
 * : BEAN + cBEAN => BEAN_CRV3_LP => SILO:BEAN_CRV3_LP
 *
 * : ETH => WETH => USDT => CRV3 => BEAN_CRV3_LP
 * : WETH => USDT => CRV3 => BEAN_CRV3_LP
 * : CRV3_Underlying => CRV3 => BEAN_CRV3_LP
 * : CRV3 => BEAN_CRV3_LP
 * : BEAN_CRV3_LP => BEAN_CRV3_LP
 *
 * SILO:UR_BEAN
 *  : BEAN => UR_BEAN
 *
 * SILO:UR_BEAN_CRV3_LP
 * : UR_BEAN_CRV3_LP => UR_BEAN_CRV3_LP
 */

export class DepositFarmStep extends FarmStep {
  constructor(
    _sdk: BeanstalkSDK,
    private _target: ERC20Token
  ) {
    super(_sdk);
    this._target = _target;
  }

  build(
    tokenIn: Token,
    amountIn: TokenValue,
    fromMode: FarmFromMode,
    operation: BeanSwapOperation | undefined,
    account: string,
    claimAndDoX: ClaimAndDoX
  ) {
    this.clear();
    /**
     * TODO: Find a better way to do this... maybe use a graph?
     */
    const { BEAN } = this._sdk.tokens;
    if (claimAndDoX.claimedBeansUsed.lte(0) && amountIn.lte(0)) {
      throw new Error('No amount');
    }

    // If we're not using claimed Beans or if we are depositing unripe assets,
    // we can just deposit as normal
    if (tokenIn.isUnripe) {
      if (this._target.isUnripe && !tokenIn.equals(this._target)) {
        throw new Error('Depositing with non-unripe assets is not supported');
      }
      const deposit = this._sdk.silo.buildDeposit(this._target, account);
      deposit.setInputToken(tokenIn, fromMode);
      this.pushInput({
        input: [...deposit.workflow.generators] as StepGenerator[],
      });
      return this;
    }

    const claimedBeansUsed = claimAndDoX.claimedBeansUsed;
    // if we are claiming & depositing, just build 2 deposits

    // x -> LP token
    if (operation !== undefined) {
      this.pushInput({
        input: [
          ...operation.getFarm().generators,
        ] as StepGenerator[],
      });
      const deposit = this._sdk.silo.buildDeposit(this._target, account);
      deposit.setInputToken(this._target, FarmFromMode.INTERNAL_TOLERANT);
      this.pushInput({
        input: [...deposit.workflow.generators] as StepGenerator[],
      });
    } else {
      const deposit = this._sdk.silo.buildDeposit(this._target, account);
      deposit.setInputToken(tokenIn, fromMode);
      this.pushInput({
        input: [...deposit.workflow.generators] as StepGenerator[],
      });
    }

    if (claimAndDoX?.claimedBeansUsed.gt(0) && !tokenIn.isUnripe) {
      const depositOperation = this._sdk.silo.buildDeposit(
        this._target,
        account
      );
      depositOperation.setInputToken(BEAN, FarmFromMode.INTERNAL_TOLERANT);
      this.pushInput(
        makeLocalOnlyStep({
          name: 'deposit-claimed-beans',
          amount: {
            overrideAmount: claimedBeansUsed,
          },
        })
      );
      this.pushInput({
        input: [...depositOperation.workflow.generators] as StepGenerator[],
      });
    }

    // add transfer step if needed
    this.pushInput(claimAndDoX.getTransferStep(account));

    console.debug('[DepositStrategy][build]: ', this.getFarmInput());
    return this;
  }

  private getDeposit(account: string) {
    const balanceStep = () => {
      const beanstalk = this._sdk.contracts.beanstalk;
      return {
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('getInternalBalance', [
          account,
          this._target.address,
        ]),
        clipbaord: Clipboard.encode([]),
      };
    };

    const depositStep = new this._sdk.farm.actions.Deposit(
      this._target,
      FarmFromMode.INTERNAL_TOLERANT,
      {
        tag: 'token-balance',
        copySlot: 0,
        pasteSlot: 1,
      }
    );

    return {
      balanceStep,
      balanceTag: 'token-balance',
      depositStep,
    };
  }

  private getSwapOperation(
    swapQuote: BeanSwapNodeQuote | undefined,
    sellToken: Token,
    sellAmount: TokenValue,
    account: string,
    fromMode: FarmFromMode
  ) {
    if (sellToken.equals(this._target)) {
      return;
    }
    if (!swapQuote) {
      throw new Error('No Deposit quote found');
    }

    const lastNode = swapQuote.nodes[swapQuote.nodes.length - 1];
    if (!lastNode.sellToken.equals(sellToken)) {
      throw new Error('Token input mismatch');
    }
    if (!lastNode.buyToken.equals(this._target)) {
      throw new Error('Target token mismatch');
    }
    if (!sellAmount.eq(swapQuote.sellAmount)) {
      throw new Error('Sell amount mismatch');
    }

    const operation = BeanSwapOperation.buildWithQuote(
      swapQuote,
      account,
      account,
      fromMode,
      FarmToMode.INTERNAL
    );

    return operation;
  }

  public static async quote(
    sdk: BeanstalkSDK,
    _account: string | undefined,
    tokenIn: Token,
    amountIn: TokenValue,
    target: Token,
    fromMode: FarmFromMode
  ) {
    const account = _account || (await sdk.getAccount());

    if (!account) {
      throw new Error('Signer required');
    }

    const isTargetBEAN = target.equals(sdk.tokens.BEAN);
    const isInputBEAN = tokenIn.equals(sdk.tokens.BEAN);
  }

  // Static methods
  public static async getAmountOut(
    sdk: BeanstalkSDK,
    _account: string | undefined,
    tokenIn: Token,
    amountIn: TokenValue,
    target: Token
  ) {
    const account = _account || (await sdk.getAccount());

    if (!account) {
      throw new Error('Signer required');
    }

    if (tokenIn.equals(target)) {
      return undefined;
    }

    const quoter = sdk.beanSwap.quoter;

    const quote = await quoter.route(
      tokenIn as ERC20Token | NativeToken,
      target as ERC20Token | NativeToken,
      amountIn,
      0.1
    );

    if (!quote) {
      throw new Error(
        `Depositing ${target.symbol} to the Silo via ${tokenIn.symbol} is currently unsupported.`
      );
    }
    console.debug('[DepositFarmStep][getAmoutOut] estimate = ', quote);

    return quote;
  }
}
