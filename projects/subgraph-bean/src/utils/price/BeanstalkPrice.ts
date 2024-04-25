import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  BeanstalkPrice,
  BeanstalkPrice__priceResultPPsStruct,
  BeanstalkPrice__priceResultPStruct
} from "../../../generated/Beanstalk/BeanstalkPrice";
import { loadBean } from "../Bean";
import { BEANSTALK_PRICE } from "../../../../subgraph-core/utils/Constants";

export class BeanstalkPriceResult {
  // reverted: boolean;
  // value: BeanstalkPrice__priceResultPStruct | null;

  private _value: BeanstalkPrice__priceResultPStruct | null;

  constructor(value: BeanstalkPrice__priceResultPStruct | null) {
    this._value = value;
  }

  get reverted(): boolean {
    return this._value == null;
  }

  get value(): BeanstalkPrice__priceResultPStruct {
    assert(!this.reverted, "accessed value of a reverted call, please check the `reverted` field before accessing the `value` field");
    return this._value!;
  }
}

// Wrapper for BeanstalkPrice contract that handles a few things:
// (1) Only including whitelisted tokens in the final price calculation and the prices list
// (2) Which contract to call (in anticipation of new BeanstalkPrice contract deployments)
export function BeanstalkPrice_try_price(beanAddr: Address, blockNumber: BigInt): BeanstalkPriceResult {
  // TODO: when the new price contract is available, use blockNumber to determine which contract and provide bean.pools as parameter to the price function
  // let bean = loadBean(beanAddr.toHexString());

  let beanstalkPrice = BeanstalkPrice.bind(BEANSTALK_PRICE);
  let beanPrice = beanstalkPrice.try_price();

  if (beanPrice.reverted) {
    return new BeanstalkPriceResult(null);
  }

  // changetype is necessary as there are identical responses from different generated contract objects.
  // If the response structure changes in the future, this will need to be revisited.
  return new BeanstalkPriceResult(changetype<BeanstalkPrice__priceResultPStruct>(beanPrice.value));
}

// Extracts the pool price from the larger result
export function getPoolPrice(priceResult: BeanstalkPriceResult, pool: Address): BeanstalkPrice__priceResultPPsStruct | null {
  for (let i = 0; i < priceResult.value.ps.length; ++i) {
    if (priceResult.value.ps[i].pool == pool) {
      return priceResult.value.ps[i];
    }
  }
  return null;
}
