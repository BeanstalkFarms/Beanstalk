import {
  BeanstalkSDK,
  FarmFromMode,
  FarmToMode,
  StepGenerator,
  Token,
  TokenValue,
} from '@beanstalk/sdk';

import { FarmStepStrategy, StepsWithOptions } from '~/lib/Txn/Strategy';
import { makeLocalOnlyStep } from '../../util';

type DepositParams = {
  /// whitelisted token
  target: Token;
  /** */
  account: string;
  /** */
  tokenIn: Token;
  /** */
  amountIn: TokenValue;
  /** */
  fromMode: FarmFromMode;
  /** */
  claimedBeansUsed?: TokenValue;
};

export class DepositStrategy extends FarmStepStrategy {
  constructor(_sdk: BeanstalkSDK, private _params: DepositParams) {
    super(_sdk);
    this._params = _params;
  }

  /**
   * Deposit scenarios:
   *
   * SILO:BEAN
   * : ETH => WETH => USDT => BEAN + cBEAN ==> SILO:BEAN
   * : BEAN + cBEAN => SILO:BEAN
   *
   * SILO:BEAN_CRV3_LP
   * : BEAN + cBEAN => BEAN_CRV3_LP => SILO:BEAN_CRV3_LP
   *
   * : ETH => WETH => USDT => CRV3 => BEAN_CRV3_LP
   * : USDT => CRV3 => BEAN_CRV3_LP
   * : CRV3 => BEAN_CRV3_LP
   * : BEAN_CRV3_LP => BEAN_CRV3_LP
   */

  getSteps() {
    /**
     * TODO: Find a better way to do this... maybe use a graph?
     */
    const { BEAN } = DepositStrategy.sdk.tokens;

    const steps: StepsWithOptions[] = [];

    const { claimedBeansUsed, fromMode, tokenIn, target, account, amountIn } =
      this._params;

    if (claimedBeansUsed?.lte(0) && amountIn.lte(0)) {
      throw new Error('No amount');
    }

    /// If we're not using claimed Beans, we can just deposit as normal
    if (!claimedBeansUsed || claimedBeansUsed?.lte(0)) {
      if (target.isLP && !tokenIn.isLP) {
        throw new Error('Depositing with non-unripe assets is not supported');
      }
      const deposit = DepositStrategy.sdk.silo.buildDeposit(target, account);
      deposit.setInputToken(tokenIn, fromMode);
      steps.push({
        steps: [...deposit.workflow.generators] as StepGenerator[],
      });

      console.debug('[DepositStrategy][getSteps]: ', steps);
      return steps;
    }

    const isTargetBean = BEAN.equals(target);
    const isInputBean = BEAN.equals(tokenIn);

    if (isTargetBean) {
      let _from: FarmFromMode;
      if (!isInputBean) {
        const swap = DepositStrategy.sdk.swap.buildSwap(
          this._params.tokenIn,
          this._params.target,
          this._params.account,
          this._params.fromMode,
          FarmToMode.INTERNAL
        );
        steps.push({
          steps: [...swap.getFarm().generators] as StepGenerator[],
        });
        _from = FarmFromMode.INTERNAL_TOLERANT;
      } else {
        _from = FarmFromMode.INTERNAL_EXTERNAL;
      }
      /// We know that amountOut from the previous step is in BEAN
      /// add the additional amount to the deposit
      steps.push(
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
      const deposit = DepositStrategy.sdk.silo.buildDeposit(target, account);
      deposit.setInputToken(BEAN, _from);
      steps.push({
        steps: [...deposit.workflow.generators] as StepGenerator[],
      });
    } else if (isInputBean) {
      // If the input is BEAN, we deposit BEAN + cBEAN as a single deposit for the target
      const deposit = DepositStrategy.sdk.silo.buildDeposit(target, account);
      deposit.setInputToken(tokenIn, FarmFromMode.INTERNAL_EXTERNAL);

      steps.push(
        makeLocalOnlyStep({
          name: 'pre-deposit-bean-and-claimed-beans',
          amount: {
            overrideAmount: claimedBeansUsed.add(amountIn),
          },
        })
      );
      steps.push({
        steps: [...deposit.workflow.generators] as StepGenerator[],
      });
    } else {
      // If the target is not BEAN, instead of swapping claimed BEAN for CRV3, we opt for 2 deposits
      const deposit = DepositStrategy.sdk.silo.buildDeposit(target, account);
      const depositClaimed = DepositStrategy.sdk.silo.buildDeposit(
        target,
        account
      );

      deposit.setInputToken(tokenIn, fromMode);
      depositClaimed.setInputToken(BEAN, FarmFromMode.INTERNAL_TOLERANT);

      steps.push({
        steps: [...deposit.workflow.generators] as StepGenerator[],
      });

      steps.push(
        makeLocalOnlyStep({
          name: 'deposit-claimed-beans',
          amount: {
            overrideAmount: claimedBeansUsed,
          },
        })
      );
      steps.push({
        steps: [...depositClaimed.workflow.generators] as StepGenerator[],
      });
    }

    console.debug('[DepositStrategy][getSteps]: ', steps);

    return steps;
  }
}
