// import { ethers } from "ethers";
// import { BasicPreparedResult, RunContext, StepClass } from "src/classes/Workflow";

// // to be used in pipeline

// export class UnwrapAndSendEth extends StepClass<BasicPreparedResult> {
//   public name: string = "unwrapAndSendEth";

//   constructor(public readonly to: string) {
//     super();
//   }

//   async run(_amountInStep: ethers.BigNumber, context: RunContext) {
//     return {
//       name: this.name,
//       amountOut: _amountInStep,
//       value: _amountInStep,
//       prepare: () => ({
//         target: UnwrapAndSendEth.sdk.contracts.
//       })
//     };
//   }
// }
