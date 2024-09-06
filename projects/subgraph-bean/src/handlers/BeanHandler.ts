import { ADDRESS_ZERO } from "../../../subgraph-core/utils/Constants";
import { Transfer } from "../../generated/Bean-ABIs/ERC20";
import { adjustSupply, updateBeanSupplyPegPercent } from "../utils/Bean";

export function handleTransfer(event: Transfer): void {
  if (event.params.from == ADDRESS_ZERO || event.params.to == ADDRESS_ZERO) {
    adjustSupply(event.address, event.params.from == ADDRESS_ZERO ? event.params.value : event.params.value.neg());
    updateBeanSupplyPegPercent(event.address, event.block.number);
  }
}
