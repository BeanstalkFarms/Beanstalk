import { Address } from "@graphprotocol/graph-ts";
import { UNRIPE_BEAN, UNRIPE_LP } from "../../../../subgraph-core/utils/Constants";

export function isUnripe(token: Address): boolean {
  const unripeTokens = [UNRIPE_BEAN, UNRIPE_LP];
  for (let i = 0; i < unripeTokens.length; ++i) {
    if (unripeTokens[i] == token) {
      return true;
    }
  }
  return false;
}
