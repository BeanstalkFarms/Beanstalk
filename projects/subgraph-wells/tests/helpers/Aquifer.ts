import { Address, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as/assembly/index";
import { BoreWell } from "../../generated/Aquifer/Aquifer";
import { handleBoreWell } from "../../src/templates/AquiferHandler";
import { BEAN_ERC20, WETH } from "../../src/utils/Constants";
import { AQUIFER, AUGER, PUMP, WELL, WELL_FUNCTION } from "./Constants";

export function createBoreWellEvent(aquifer: Address, well: Address, tokens: Address[], wellFunction: ethereum.Tuple, pumps: ethereum.Tuple[], auger: Address): BoreWell {
    let event = changetype<BoreWell>(newMockEvent())

    event.address = aquifer
    event.parameters = new Array()

    let param1 = new ethereum.EventParam("well", ethereum.Value.fromAddress(well))
    let param2 = new ethereum.EventParam("tokens", ethereum.Value.fromAddressArray(tokens))
    let param3 = new ethereum.EventParam("wellFunction", ethereum.Value.fromTuple(wellFunction))
    let param4 = new ethereum.EventParam("pumps", ethereum.Value.fromTupleArray(pumps))
    let param5 = new ethereum.EventParam("auger", ethereum.Value.fromAddress(auger))

    event.parameters.push(param1)
    event.parameters.push(param2)
    event.parameters.push(param3)
    event.parameters.push(param4)
    event.parameters.push(param5)

    return event as BoreWell
}

export function boreDefaultWell(): void {
    let wellFunctionTuple = new ethereum.Tuple()
    wellFunctionTuple.push(ethereum.Value.fromAddress(WELL_FUNCTION))
    wellFunctionTuple.push(ethereum.Value.fromBytes(Bytes.empty()))

    let pump1Tuple = new ethereum.Tuple()
    pump1Tuple.push(ethereum.Value.fromAddress(PUMP))
    pump1Tuple.push(ethereum.Value.fromBytes(Bytes.empty()))

    let boreWellEvent = createBoreWellEvent(
        AQUIFER,
        WELL,
        [BEAN_ERC20, WETH],
        wellFunctionTuple,
        [pump1Tuple],
        AUGER
    )

    handleBoreWell(boreWellEvent)
}
