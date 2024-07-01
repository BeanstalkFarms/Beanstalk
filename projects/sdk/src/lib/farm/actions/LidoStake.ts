// import { BigNumber } from 'ethers';
// import { TokenValue } from "@beanstalk/sdk-core";
// import { BasicPreparedResult, RunContext, StepClass } from "src/classes/Workflow";
// import ethers from 'ethers';

// export class LidoStake extends StepClass<BasicPreparedResult> {
//     public name: string = "lido-stake";

//     constructor(
//         private _amountIn: TokenValue,
//     ) {
//         super();
//     }

//     async run(_amountInStep: ethers.BigNumber, context: RunContext) {
//         return {
//             name: this.name,
//             amountOut: _amountInStep,
//             prepare: () => {
//                 LidoStake.sdk.debug(`[${this.name}.encode()]`, {
//                     value: _amountInStep
//                 });

//                 const sdk = LidoStake.sdk;

//                 return {
//                     target: "",
//                     callData: "",
//                     // target: LidoStake.sdk.contracts.lido.steth.address,
//                 }
//             }
//         }
//     }
// }

// /**
//  *
//  *
//  * BEAN -> WETH -> WETH (unwrap & Sent ETH contract) => pipeline ->
//  *
//  *
//  *
//  * ROUTES:
//  *
//  * (x -> wstETH)
//  * WETH -> ETH -> stETH (lido) -> wstETH (lido-wrap)
//  * WETH -> wStETH (uniswap)
//  *
//  * (wstETH -> x)
//  * Uniswap
//  * wstETH -> ETH -> x
//  *
//  *
//  *
//  * Deposit
//  *
//  *
//  */
