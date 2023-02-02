import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as/assembly/index";
import { Swap } from "../../generated/templates/Well/Well";

export function createSwapEvent(well: Address, fromToken: Address, toToken: Address, amountIn: BigInt, amountOut: BigInt): Swap {
    let event = changetype<Swap>(newMockEvent())

    event.address = well
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
