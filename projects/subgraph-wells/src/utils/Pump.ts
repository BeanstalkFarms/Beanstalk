import { Address } from "@graphprotocol/graph-ts";
import { Pump } from "../../generated/schema";

export function loadOrCreatePump(pumpAddress: Address, wellAddress: Address): Pump {
    let id = pumpAddress.toHexString() + '-' + wellAddress.toHexString()
    let pump = Pump.load(id)
    if (pump == null) {
        pump = new Pump(id)
        pump.well = wellAddress
        pump.save()
    }
    return pump as Pump
}
