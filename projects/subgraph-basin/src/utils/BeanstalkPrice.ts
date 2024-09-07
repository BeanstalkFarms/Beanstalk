// Unfortunately this file must be copied across the various subgraph projects. This is due to the codegen
import { Address, BigInt } from "@graphprotocol/graph-ts";
import { BeanstalkPrice } from "../../generated/Basin-ABIs/BeanstalkPrice";
import { BEANSTALK_PRICE_1, BEANSTALK_PRICE_2, PRICE_2_BLOCK } from "../../../subgraph-core/constants/BeanstalkEth";

// Gets the BeanstalkPrice contract, bound to the appropriate instance of the contract.
// Note: Will bind to PRICE_1 even if that contract has not been deployed yet
// Thus the caller still needs to check for reverts.
export function getBeanstalkPrice(blockNumber: BigInt): BeanstalkPrice {
  let contractAddress: Address;
  if (blockNumber < PRICE_2_BLOCK) {
    contractAddress = BEANSTALK_PRICE_1;
  } else {
    contractAddress = BEANSTALK_PRICE_2;
  }
  return BeanstalkPrice.bind(contractAddress);
}
