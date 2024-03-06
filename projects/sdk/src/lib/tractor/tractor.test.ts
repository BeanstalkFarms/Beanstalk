// This test uses the Tractor SDK and core Tractor code. It represents how an end user would interact with Tractor.

import { ethers } from "ethers";
import { Blueprint, Requisition } from "./types";
import { createBlueprint_mow } from "./examples";
import { addresses } from "src/constants";
import { getTestUtils } from "src/utils/TestUtils/provider";

const { sdk, account, utils } = getTestUtils();
jest.setTimeout(30 * 1000);

describe("tractor mow", () => {
  beforeAll(async function () {
    // Ensure contract deployment.
    // TODO TEMP remove this once mainnet deployment.
    expect(
      (await sdk.provider.getCode(addresses.JUNCTION.get(sdk.chainId))).length
    ).toBeGreaterThan(2);

    await utils.setETHBalance(account, sdk.tokens.ETH.amount(10));
  });

  it("throws if tractor operate fails", async () => {
    let publisher: ethers.Wallet = ethers.Wallet.createRandom();
    const blueprint: Blueprint = createBlueprint_mow(sdk, publisher.address);
    const blueprintHash: string = await sdk.tractor.getBlueprintHash(blueprint);
    const requisition: Requisition = {
      blueprint: blueprint,
      blueprintHash: blueprintHash,
      signature: await publisher.signMessage(blueprintHash)
    };

    const operatorData: ethers.Bytes = ethers.utils.arrayify("0x");

    await sdk.contracts.beanstalk
      .tractor(requisition, operatorData, { gasLimit: 1_000_000 })
      .then((txn) => txn.wait());
  });
});
