import { assert } from "matchstick-as/assembly/index";
import { BigDecimal } from "@graphprotocol/graph-ts";

export function assertBDClose(expected: BigDecimal, actual: BigDecimal): void {
  const diff = actual.minus(expected);
  assert.assertTrue(diff < BigDecimal.fromString("0.1"));
}
