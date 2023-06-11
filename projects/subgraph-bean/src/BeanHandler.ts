import { log } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/Bean/Bean";
import { loadBean, updateBeanSupplyPegPercent } from "./utils/Bean";
import { ADDRESS_ZERO } from "./utils/Constants";

export function handleTransfer(event: Transfer): void {
  if (event.params.from == ADDRESS_ZERO || event.params.to == ADDRESS_ZERO) {
    let bean = loadBean(event.address.toHexString());

    if (event.params.from == ADDRESS_ZERO) {
      // Minted
      bean.supply = bean.supply.plus(event.params.value);
    } else {
      // Burned
      bean.supply = bean.supply.minus(event.params.value);
    }
    bean.save();

    updateBeanSupplyPegPercent(event.block.number);
  }
}
