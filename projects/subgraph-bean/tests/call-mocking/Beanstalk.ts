import { BigDecimal, BigInt, ethereum, Address } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as/assembly/index";
import { BEANSTALK } from "../../../subgraph-core/utils/Constants";

export function mockSeedGaugeLockedBeans(lockedBeans: BigInt): void {
  createMockedFunction(BEANSTALK, "getLockedBeans", "getLockedBeans():(uint256)")
    .withArgs([])
    .returns([ethereum.Value.fromUnsignedBigInt(lockedBeans)]);
}

export function mockSeedGaugeLockedBeansReverts(): void {
  createMockedFunction(BEANSTALK, "getLockedBeans", "getLockedBeans():(uint256)").withArgs([]).reverts();
}

export function mockGetRecapPaidPercent(repaidPercent: BigDecimal): void {
  createMockedFunction(BEANSTALK, "getRecapPaidPercent", "getRecapPaidPercent():(uint256)")
    .withArgs([])
    .returns([
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(repaidPercent.times(BigDecimal.fromString("1000000")).truncate(0).toString()))
    ]);
}

export function mockGetTotalUnderlying(unripeToken: Address, underlying: BigInt): void {
  createMockedFunction(BEANSTALK, "getTotalUnderlying", "getTotalUnderlying(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(unripeToken)])
    .returns([ethereum.Value.fromUnsignedBigInt(underlying)]);
}
