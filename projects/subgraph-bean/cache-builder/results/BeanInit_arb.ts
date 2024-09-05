/* This is a generated file */

import { BigInt, BigDecimal } from "@graphprotocol/graph-ts";

class BeanInitialValues {
  volume: BigInt;
  volumeUsd: BigDecimal;
  crosses: i32;
  lastCross: BigInt;
  lastSeason: i32;
}

export const BEAN_INITIAL_VALUES: BeanInitialValues = {
  volume: BigInt.fromU64(1),
  volumeUsd: BigDecimal.fromString("1.2"),
  crosses: 1,
  lastCross: BigInt.fromU64(1),
  lastSeason: 3
};
