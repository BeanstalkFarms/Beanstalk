import { Transfer } from "../generated/Bean/ERC20";
import { loadBean, updateBeanSupplyPegPercent } from "./utils/Bean";
import { ADDRESS_ZERO, BEAN_ERC20_V1 } from "../../subgraph-core/utils/Constants";

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

    if (event.address != BEAN_ERC20_V1) {
      updateBeanSupplyPegPercent(event.block.number);
    }
  }
}
