// This test uses the Tractor SDK and core Tractor code. It represents how an end user would interact with Tractor.

import { ethers } from "ethers";
import { Blueprint, Requisition } from "./types";
import { createBlueprint_mow } from "./examples";
import { Tractor } from "./tractor";
import { getTestUtils } from "src/utils/TestUtils/provider";

const { sdk, account, utils } = getTestUtils();

describe("tractor mow", async () => {
  it("throws if tractor operate fails", async () => {
    let publisher: ethers.Wallet = ethers.Wallet.createRandom();
    const blueprint: Blueprint = createBlueprint_mow(publisher.address);
    const blueprintHash: string = await Tractor.getBlueprintHash(blueprint);
    const requisition: Requisition = {
      blueprint: blueprint,
      blueprintHash: blueprintHash,
      signature: await publisher.signMessage(blueprintHash)
    };

    await sdk.contracts.beanstalk.runBlueprint(requisition).then((txn) => txn.wait());
  });
});
