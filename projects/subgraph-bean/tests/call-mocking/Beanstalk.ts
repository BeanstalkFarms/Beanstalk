import { BigInt, ethereum } from "@graphprotocol/graph-ts";
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

export function mockPreGaugeLockedBeans(lockedBeans: BigInt): void {}
