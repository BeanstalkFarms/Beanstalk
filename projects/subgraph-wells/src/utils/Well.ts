import { Address } from "@graphprotocol/graph-ts";
import { Well } from "../../generated/schema";
import { ADDRESS_ZERO } from "./Constants";

export function loadOrCreateWell(wellAddress: Address): Well {
    let well = Well.load(wellAddress)
    if (well == null) {
        well = new Well(wellAddress)
        well.tokens = []
        well.wellFunction = ADDRESS_ZERO
        well.pumps = []
        well.auger = ADDRESS_ZERO
        well.save()
    }
    return well as Well
}
