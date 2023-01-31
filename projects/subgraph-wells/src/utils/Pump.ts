import { Address } from "@graphprotocol/graph-ts";
import { Pump } from "../../generated/schema";

export function loadOrCreatePump(pumpAddress: Address, wellAddress: Address): Pump {
    let pump = Pump.load(pumpAddress.concat(wellAddress))
    if (pump == null) {
        pump = new Pump(pumpAddress.concat(wellAddress))
        pump.well = wellAddress
        pump.save()
    }
    return pump as Pump
}
