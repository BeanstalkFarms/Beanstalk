import { Address, ethereum, log } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as/assembly/index";
import { BoreWell, BoreWellPumpsStruct, BoreWellWellFunctionStruct } from "../../generated/Aquifer/Aquifer";

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
