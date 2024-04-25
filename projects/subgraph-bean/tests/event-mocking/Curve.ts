import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as";

import { TokenExchangeUnderlying } from "../../generated/Bean3CRV-V1/Bean3CRV";
import { mockContractEvent } from "../../../subgraph-core/tests/event-mocking/Util";
import { BEAN_3CRV_V1 } from "../../../subgraph-core/utils/Constants";

export function mock_virtual_price(contract: Address, retval: BigInt): void {
  createMockedFunction(contract, "get_virtual_price", "get_virtual_price():(uint256)")
    .withArgs([])
    .returns([ethereum.Value.fromUnsignedBigInt(retval)]);
}

export function createTokenExchangeUnderlyingEvent(
  buyer: Address,
  sold_id: BigInt,
  tokens_sold: BigInt,
  bought_id: BigInt,
  tokens_bought: BigInt
): TokenExchangeUnderlying {
  let event = changetype<TokenExchangeUnderlying>(mockContractEvent(BEAN_3CRV_V1));
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("buyer", ethereum.Value.fromAddress(buyer));
  let param2 = new ethereum.EventParam("sold_id", ethereum.Value.fromUnsignedBigInt(sold_id));
  let param3 = new ethereum.EventParam("tokens_sold", ethereum.Value.fromUnsignedBigInt(tokens_sold));
  let param4 = new ethereum.EventParam("bought_id", ethereum.Value.fromUnsignedBigInt(bought_id));
  let param5 = new ethereum.EventParam("tokens_bought", ethereum.Value.fromUnsignedBigInt(tokens_bought));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);

  return event as TokenExchangeUnderlying;
}
