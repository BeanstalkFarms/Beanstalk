import { BasicPreparedResult, RunContext, Step, StepClass } from "src/classes/Workflow";
import { ethers } from "ethers";
import { FarmToMode } from "../types";

/**
 * @deprecated The `claimWithdrawals` contract function was removed from regular
 * usage in the Silo V3 upgrade to Beanstalk. The function remains on a legacy
 * facet for backwards compatibility, but it's only use is to claim withdrawals
 * that were initiated before the upgrade.
 *
 * See: contracts/beanstalk/silo/SiloFacet/LegacyClaimWithdrawalFacet.sol
 */
export class ClaimWithdrawals extends StepClass<BasicPreparedResult> {
  public name: string = "claimWithdrawals";

  constructor(public readonly _tokenIn: string, public readonly _seasons: ethers.BigNumberish[], public readonly _to: FarmToMode) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    ClaimWithdrawals.sdk.debug(`[${this.name}.run()]`, {
      tokenIn: this._tokenIn,
      seasons: this._seasons,
      to: this._to
    });
    return {
      name: this.name,
      amountOut: _amountInStep,
      prepare: () => {
        ClaimWithdrawals.sdk.debug(`[${this.name}.encode()]`, {
          tokenIn: this._tokenIn,
          seasons: this._seasons,
          to: this._to
        });
        return {
          target: ClaimWithdrawals.sdk.contracts.beanstalk.address,
          callData: ClaimWithdrawals.sdk.contracts.beanstalk.interface.encodeFunctionData("claimWithdrawals", [
            this._tokenIn, //
            this._seasons, //
            this._to
          ])
        };
      },
      decode: (data: string) => ClaimWithdrawals.sdk.contracts.beanstalk.interface.decodeFunctionData("claimWithdrawals", data),
      decodeResult: (result: string) => ClaimWithdrawals.sdk.contracts.beanstalk.interface.decodeFunctionResult("claimWithdrawals", result)
    };
  }
}
