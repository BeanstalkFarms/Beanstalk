import { BeanstalkSDK, TokenValue } from '@beanstalk/sdk';
import { BigNumber } from 'ethers';
import {
  EnrootFarmStep,
  HarvestFarmStep,
  MowFarmStep,
  PlantFarmStep,
  RinseFarmStep,
} from '~/lib/Txn/FarmSteps';
import { FarmStep } from '~/lib/Txn/Interface';
import {
  FormTxn,
  FormTxnBundlerInterface,
  FormTxnMap,
} from '~/lib/Txn/FormTxn/types';
import { FormTxnBundlerPresets as presets } from '~/lib/Txn/FormTxn/presets';
import { Token } from '@beanstalk/sdk-core';
import { FarmWorkflow, AdvancedFarmWorkflow } from '~/types';

type FormTxnFarmStep =
  | MowFarmStep
  | PlantFarmStep
  | EnrootFarmStep
  | RinseFarmStep
  | HarvestFarmStep;

/**
 * Notes: @Bean-Sama
 *
 * FormTxnBundler bundles transactions comparatmentalized as:
 *    1. a main operation to be performed (e.g., Silo Deposit).
 *    2. 'FarmStep's to be performed BEFORE the main operation.
 *    3. 'FarmStep's to be performed AFTER the main operation.
 *
 * This helps faciliate the following user flows:
 *    - ClaimAndDoX: Claiming BEAN & perform an operation with earned BEANs (e.g. Claim BEAN -> Sow)
 *    - PlantAndDoX: Plant earned Silo Rewards & perform a txn with planted assets (e.g. Plant -> Convert)
 *
 * Intended Usage:
 *    1. Instantiate a FormTxnBundler with a BeanstalkSDK instance
 *       and a map of FormTxns enabled for the current user.
 *
 *    2. Call setFarmSteps() to add FarmSteps to the bundler's 'before' and 'after' maps.
 *        - it is intended for this to be called in an 'onSubmit' function where the user
 *          has confirmed which FarmSteps they want to perform.
 *        - setFarmSteps() deduplicates any FarmSteps that are implied by other FarmSteps
 *          as well as any FarmSteps that are excluded by the form.
 *
 *    3. Call build() to perform the bundling of FarmSteps into a single, executable Workflow.
 *        - It is assumed every FarmStep added to have previous been 'built'.
 *        - Returns a 'execute' function, which will execute the Workflow.
 *    4. Once executed, instantiate a new FormTxnBundler to remove the previous bundled steps.
 *
 *
 * Limitations & Vulnerabilities:
 *    - Currently, the bundler defers the responsibility of handling the cases where 'before' steps are added to
 *      the main operation. For example, In the scenario where the  user wants to 'plant' & 'convert', the bundler
 *      will assume that 'ConvertFarmStep' (FarmStepClass for Convert) has been built expecting 'plant' to be
 *      added before it in the workflow.
 *
 *    - The bundler assumes that the set of operations that can be added before or after the main operation
 *      are limited to 'ClaimWithdawals', 'Rinse', 'Harvest', 'Mow', 'Plant', and 'Enroot'.
 *
 * - For more on 'Workflow's, refer to the BeanstalkSDK documentation.
 * - For more on 'FarmStep's, refer to the individual FarmStep classes.
 */

export class FormTxnBundler {
  private before: Partial<FormTxnMap<FarmStep>>;

  private after: Partial<FormTxnMap<FarmStep>>;

  // FormTxns that imply other FormTxns when added
  static implied: Partial<FormTxnMap> = {
    [FormTxn.ENROOT]: FormTxn.MOW,
    [FormTxn.PLANT]: FormTxn.MOW,
  };

  static presets = presets;

  constructor(
    private _sdk: BeanstalkSDK,
    private _farmSteps: Partial<FormTxnMap<FormTxnFarmStep>>
  ) {
    this._sdk = _sdk;
    this._farmSteps = _farmSteps;
    this.before = {};
    this.after = {};
  }

  public getMap() {
    return this._farmSteps;
  }

  public getFarmStep(formTxn: FormTxn): FormTxnFarmStep | undefined {
    return this._farmSteps[formTxn];
  }

  /**
   * adds FarmSteps to the bundler's 'before' and 'after' steps.
   */
  public setFarmSteps(data: FormTxnBundlerInterface, clear: boolean = true) {
    console.debug(`[FormTxnBundler][addSteps] farmSteps`, this._farmSteps);
    const actions = FormTxnBundler.deduplicateFarmSteps(data);

    const _before = clear ? {} : this.before;
    const _after = clear ? {} : this.after;

    actions.before.forEach((formTxn) => {
      _before[formTxn] = this._farmSteps[formTxn];
    });

    if (clear) this.after = {};
    actions.after.forEach((formTxn) => {
      _after[formTxn] = this._farmSteps[formTxn];
    });

    this.before = _before;
    this.after = _after;

    console.debug('[FormTxnBundler][addFarmSteps/before]', this.before);
    console.debug('[FormTxnBundler][addFarmSteps/after]', this.after);

    return actions.allActions;
  }

  public async bundle(
    operation: FarmStep,
    amountIn: TokenValue,
    slippage: number,
    gasMultiplier?: number,
    advancedFarm?: boolean
  ) {
    let farm: FarmWorkflow | AdvancedFarmWorkflow;
    if (advancedFarm) {
      farm = this._sdk.farm.createAdvancedFarm();
    } else {
      farm = this._sdk.farm.create();
    }

    Object.entries(this.before).forEach(([step, farmStep]) => {
      const farmInput = farmStep.getFarmInput();
      if (!farmInput.length) {
        throw new Error(`Expected FarmStep ${step.toLowerCase()} to be built`);
      }
      farmInput.forEach(({ input, options }) => {
        farm.add(input, options);
      });
    });

    operation.getFarmInput().forEach((_input) => {
      farm.add(_input.input, _input.options);
    });

    // Here we build a map of tokens that will be mown taking into account
    // internal mow calls inside Plant and Enroot
    const allSteps = Object.entries(this.after);
    let tokensToMow: Map<Token, TokenValue> = new Map();
    let tokensToRemove: string[] = [];
    allSteps.forEach((farmOp) => {
      if (farmOp[1] instanceof MowFarmStep) {
        // Create map of tokens to Mow
        tokensToMow = farmOp[1]._tokensToMow;
      } else if (farmOp[1] instanceof PlantFarmStep) {
        // If there's a Plant step, add Bean to the list of tokens to remove
        tokensToRemove.push(this._sdk.tokens.BEAN.address);
      } else if (farmOp[1] instanceof EnrootFarmStep) {
        // If there's an Enroot step, add token(s) to the list of tokens to remove
        const tokensEnrooted = Object.keys(farmOp[1]._crates);
        tokensToRemove = tokensToRemove.concat(tokensEnrooted);
      }
    });

    // Remove tokens from map of tokens to Mow.
    // We separate this logic from the forEach loop so
    // we aren't forced into a strict input order
    const tokenMap = this._sdk.tokens.getMap();
    tokensToRemove.forEach((token) => {
      const tokenToDelete = tokenMap.get(token);
      if (tokenToDelete) tokensToMow.delete(tokenToDelete);
    });

    allSteps.forEach(([step, farmStep]) => {
      const farmInput = farmStep.getFarmInput();
      if (!farmInput.length) {
        throw new Error(`Expected FarmStep ${step.toLowerCase()} to be built`);
      }

      farmInput.forEach(({ input, options }) => {
        // If the current step is a Mow operation
        if (farmStep instanceof MowFarmStep) {
          // We check if there's any tokens in the map of tokens to Mow
          // and build the Mow step if necessary
          if (tokensToMow.size > 0) {
            const newFarmStep = new MowFarmStep(
              this._sdk,
              farmStep._account,
              tokensToMow
            ).build();
            const newFarmInput = newFarmStep.getFarmInput();
            const newInput = newFarmInput[0].input;
            const newOptions = newFarmInput[0].options;
            farm.add(newInput, newOptions);
          }
        } else {
          farm.add(input, options);
        }
      });
    });

    console.debug('[FormTxnBundler][bundle]: farm', farm);

    const estimate = await farm.estimate(amountIn);
    console.debug('[FormTxnBundler][bundle]: estimate = ', estimate.toString());

    let gasEstimate: BigNumber;
    let adjustedGas: string;
    if (gasMultiplier) {
      gasEstimate = await farm.estimateGas(amountIn, { slippage });
      adjustedGas = Math.round(
        gasEstimate.toNumber() * gasMultiplier
      ).toString();
      console.debug(
        '[FormTxnBundler][bundle]: estimateGas = ',
        gasEstimate.toString()
      );
      console.debug('[FormTxnBundler][bundle]: adjustedGas = ', adjustedGas);
    }

    const execute = () =>
      farm.execute(
        amountIn,
        { slippage },
        gasMultiplier ? { gasLimit: adjustedGas } : undefined
      );

    return {
      estimate,
      execute,
      farm,
    };
  }

  /// ---------- private methods ----------

  /**
   * @param data
   * deduplicate farm steps.
   */
  private static deduplicateFarmSteps(data: FormTxnBundlerInterface) {
    const before = new Set(data.primary || []);
    const after = new Set(data.secondary || []);

    const allActions = new Set([...before, ...after]);
    /// deduplicate
    // if an action is in both primary and secondary, remove it from secondary
    [...before].forEach((action) => {
      if (after.has(action)) {
        after.delete(action);
      }
    });

    return {
      before: [...before],
      after: [...after],
      allActions: [...allActions],
    };
  }
}
