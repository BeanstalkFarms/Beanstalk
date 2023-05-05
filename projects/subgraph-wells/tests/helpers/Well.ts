import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as/assembly/index";
import { AddLiquidity, Swap } from "../../generated/templates/Well/Well";

export function createAddLiquidityEvent(well: Address, account: Address, lpAmountOut: BigInt, tokenAmountsIn: BigInt[]): AddLiquidity {
    let event = changetype<AddLiquidity>(newMockEvent())

    event.address = well
    event.transaction.from = account
    event.parameters = new Array()

    let param1 = new ethereum.EventParam("tokenAmountsIn", ethereum.Value.fromUnsignedBigIntArray(tokenAmountsIn))
    let param2 = new ethereum.EventParam("lpAmountOut", ethereum.Value.fromUnsignedBigInt(lpAmountOut))

    event.parameters.push(param1)
    event.parameters.push(param2)

    return event as AddLiquidity
}

export function createApprovalEvent(): void {

}

export function createRemoveLiquidityEvent(): void {

}

export function createRemoveLiquidityOneTokenEvent(): void {

}

export function createSwapEvent(
    well: Address,
    account: Address,
    fromToken: Address,
    toToken: Address,
    amountIn: BigInt,
    amountOut: BigInt
): Swap {
    let event = changetype<Swap>(newMockEvent())

    event.address = well
    event.transaction.from = account
    event.parameters = new Array()

    let param1 = new ethereum.EventParam("fromToken", ethereum.Value.fromAddress(fromToken))
    let param2 = new ethereum.EventParam("toToken", ethereum.Value.fromAddress(toToken))
    let param3 = new ethereum.EventParam("amountIn", ethereum.Value.fromUnsignedBigInt(amountIn))
    let param4 = new ethereum.EventParam("amountOut", ethereum.Value.fromUnsignedBigInt(amountOut))

    event.parameters.push(param1)
    event.parameters.push(param2)
    event.parameters.push(param3)
    event.parameters.push(param4)

    return event as Swap
}


export function createTransferEvent(): void {

}
