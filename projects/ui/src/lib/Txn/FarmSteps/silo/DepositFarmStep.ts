import {
  BeanstalkSDK,
  BeanSwapOperation,
  ERC20Token,
  FarmFromMode,
  NativeToken,
  StepGenerator,
  Token,
  TokenValue,
} from '@beanstalk/sdk';
import { ClaimAndDoX, FarmStep } from '~/lib/Txn/Interface';
import { makeLocalOnlyStep } from '~/lib/Txn/util';


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
    // LP -> LP
    } else {
      const deposit = this._sdk.silo.buildDeposit(this._target, account);
      deposit.setInputToken(tokenIn, fromMode);
      this.pushInput({
        input: [...deposit.workflow.generators] as StepGenerator[],
      });
    }

    // Claim & do X
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

  // Static methods
  public static async getAmountOut(
    sdk: BeanstalkSDK,
    _account: string | undefined,
    tokenIn: Token,
    amountIn: TokenValue,
    target: Token,
    slippage: number
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
      slippage
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