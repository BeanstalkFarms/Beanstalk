import { Address } from "@graphprotocol/graph-ts";
import { Aquifer } from "../../generated/schema";

export function loadOrCreateAquifer(aquiferAddress: Address): Aquifer {
    let aquifer = Aquifer.load(aquiferAddress)
    if (aquifer == null) {
        aquifer = new Aquifer(aquiferAddress)
        aquifer.augers = []
        aquifer.save()
    }
    return aquifer as Aquifer
}
