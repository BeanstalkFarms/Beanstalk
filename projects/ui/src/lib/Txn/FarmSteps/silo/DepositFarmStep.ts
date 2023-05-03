import {
  BeanstalkSDK,
  ERC20Token,
  FarmFromMode,
  FarmToMode,
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
  constructor(_sdk: BeanstalkSDK, private _target: ERC20Token) {
    super(_sdk);
    this._target = _target;
  }

  build(
    tokenIn: Token,
    amountIn: TokenValue,
    fromMode: FarmFromMode,
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
    if (claimAndDoX.claimedBeansUsed.lte(0) || tokenIn.isUnripe) {
      if (this._target.isUnripe && !tokenIn.equals(this._target)) {
        throw new Error('Depositing with non-unripe assets is not supported');
      }
      const deposit = this._sdk.silo.buildDeposit(this._target, account);
      deposit.setInputToken(tokenIn, fromMode);
      this.pushInput({
        input: [...deposit.workflow.generators] as StepGenerator[],
      });

      console.debug('[DepositStrategy][build]: ', this.getFarmInput());
      return this;
    }

    const claimedBeansUsed = claimAndDoX.claimedBeansUsed;
    const isTargetBean = BEAN.equals(this._target);
    const isInputBean = BEAN.equals(tokenIn);

    // If we are depositing into SILO:BEAN
    if (isTargetBean) {
      let _from: FarmFromMode = fromMode;
      // If tokenIn !== BEAN, we need to swap tokenIn => BEAN
      if (!isInputBean) {
        const swap = this._sdk.swap.buildSwap(
          tokenIn,
          this._target,
          account,
          _from,
          FarmToMode.INTERNAL
        );
        this.pushInput({
          input: [...swap.getFarm().generators] as StepGenerator[],
        });
        _from = FarmFromMode.INTERNAL_TOLERANT;
      } else if (_from === FarmFromMode.EXTERNAL) {
        _from = FarmFromMode.INTERNAL_EXTERNAL;
      }
      // fore-run the deposit of claimed beans w/ the claimed Beans used
      // If the input is BEAN, we add claimableBeansUsed, otherwise we override
      this.pushInput(
        makeLocalOnlyStep({
          name: 'deposit-claimed-beans',
          amount: {
            additionalAmount: !isInputBean ? claimedBeansUsed : undefined,
            overrideAmount: isInputBean
              ? claimedBeansUsed.add(amountIn)
              : undefined,
          },
        })
      );

      /// Deposit BEAN into SILO:BEAN
      /// at this point, we have either swapped tokenIn => BEAN or tokenIn === BEAN
      const deposit = this._sdk.silo.buildDeposit(this._target, account);
      deposit.setInputToken(BEAN, _from);
      this.pushInput({
        input: [...deposit.workflow.generators] as StepGenerator[],
      });
    }
    // If the target is NOT BEAN & the input token is BEAN,
    // we deposit BEAN + cBEAN as a single deposit for the target
    else if (isInputBean) {
      const deposit = this._sdk.silo.buildDeposit(this._target, account);
      deposit.setInputToken(tokenIn, FarmFromMode.INTERNAL_EXTERNAL);

      this.pushInput(
        makeLocalOnlyStep({
          name: 'pre-deposit-bean-and-claimed-beans',
          amount: {
            overrideAmount: claimedBeansUsed.add(amountIn),
          },
        })
      );
      this.pushInput({
        input: [...deposit.workflow.generators] as StepGenerator[],
      });
    }
    // If the target is not BEAN, instead of swapping claimed BEAN for CRV3, we opt for 2 deposits
    else {
      const deposit = this._sdk.silo.buildDeposit(this._target, account);
      const depositClaimed = this._sdk.silo.buildDeposit(this._target, account);

      deposit.setInputToken(tokenIn, fromMode);
      /// we claim all beans to 'INTERNAL' first
      depositClaimed.setInputToken(BEAN, FarmFromMode.INTERNAL_TOLERANT);
      this.pushInput({
        input: [...deposit.workflow.generators] as StepGenerator[],
      });

      // fore-run the deposit of claimed beans w/ the claimed Beans used
      this.pushInput(
        makeLocalOnlyStep({
          name: 'deposit-claimed-beans',
          amount: {
            overrideAmount: claimedBeansUsed,
          },
        })
      );
      this.pushInput({
        input: [...depositClaimed.workflow.generators] as StepGenerator[],
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
    fromMode: FarmFromMode
  ) {
    const account = _account || (await sdk.getAccount());

    if (!account) {
      throw new Error('Signer required');
    }

    const deposit = sdk.silo.buildDeposit(target, account);
    deposit.setInputToken(tokenIn, fromMode);

    const estimate = deposit.estimate(amountIn);

    if (!estimate) {
      throw new Error(
        `Depositing ${target.symbol} to the Silo via ${tokenIn.symbol} is currently unsupported.`
      );
    }
    console.debug('[DepositFarmStep][getAmoutOut] estimate = ', estimate);

    return estimate;
  }
}
