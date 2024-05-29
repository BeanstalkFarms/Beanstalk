import { BigInt, Address } from "@graphprotocol/graph-ts";
import { BEAN_WETH_CP2_WELL, BEAN_WETH_CP2_WELL_BLOCK } from "../../../subgraph-core/utils/Constants";

export enum WellFunction {
  ConstantProduct
}

class BeanWell {
  address: Address;
  startBlock: BigInt;
  wellFunction: WellFunction;
}

export const BEAN_WELLS: BeanWell[] = [
  {
    address: BEAN_WETH_CP2_WELL,
    startBlock: BEAN_WETH_CP2_WELL_BLOCK,
    wellFunction: WellFunction.ConstantProduct
  }
];
