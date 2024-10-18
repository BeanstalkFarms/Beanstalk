import { afterEach, beforeEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import { BigInt } from "@graphprotocol/graph-ts";

import { BEANSTALK } from "../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { BI_10, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { beans_BI as beans, podlineMil_BI as mil } from "../../subgraph-core/tests/Values";
import { assertFarmerHasPlot, assertFieldHas, sow } from "./utils/Field";
import { initL1Version } from "./entity-mocking/MockVersion";

const account = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".toLowerCase();

const plotStart = mil(10);
const beansSown = beans(500);
const temperature = 15;
const pods = beansSown.times(BigInt.fromI32(temperature));

// Begin tests
describe("Field", () => {
  beforeEach(() => {
    initL1Version();
  });
  afterEach(() => {
    clearStore();
  });

  test("Sow", () => {
    sow(account, plotStart, beansSown, pods);
    assertFarmerHasPlot(account, plotStart, pods);
    assertFieldHas(BEANSTALK.toHexString(), pods, ZERO_BI);

    assert.fieldEquals("Plot", plotStart.toString(), "source", "SOW");
    assert.fieldEquals("Plot", plotStart.toString(), "beansPerPod", BI_10.pow(6).div(BigInt.fromU32(temperature)).toString());
  });
});
