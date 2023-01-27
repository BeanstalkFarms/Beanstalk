import { Address } from "@graphprotocol/graph-ts";
import { Pump } from "../../generated/schema";

export function loadOrCreatePump(pumpAddress: Address): Pump {
    let pump = Pump.load(pumpAddress.toHexString())
    if (pump == null) {
        pump = new Pump(pumpAddress.toHexString())
        pump.save()
    }
    return pump as Pump
}
