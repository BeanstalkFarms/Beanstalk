import { MultiFlowPump__factory, MockPump__factory } from "src/constants/generated";
import { WellsSDK } from "./WellsSDK";
import { setReadOnly } from "./utils";
import { BigNumber } from "ethers";

export class Pump {
  readonly sdk: WellsSDK;
  readonly contract: MultiFlowPump__factory;
  readonly address: string;

  constructor(sdk: WellsSDK, address: string, public readonly data: string) {
    this.address = address;
    setReadOnly(this, "sdk", sdk, false);
    const contract = MultiFlowPump__factory.connect(address, sdk.providerOrSigner);
    setReadOnly(this, "contract", contract, true);
  }

  static async BuildMockPump(sdk: WellsSDK): Promise<Pump> {
    const mockPumpContract = new MockPump__factory(sdk.signer);
    const deployedMockPump = await mockPumpContract.deploy();

    return new Pump(sdk, deployedMockPump.address, "0x");
  }

  static async BuildMultiFlowPump(sdk: WellsSDK): Promise<Pump> {
    const contract = new MultiFlowPump__factory(sdk.signer);

    // these will need to be passed in as params and converted to bytelike or whatever
    const maxPctIncrease = "0x3ff50624dd2f1a9fbe76c8b439581062"; // 0.001
    const maxPctDecrease = "0x3ff505e1d27a3ee9bffd7f3dd1a32671"; // 1 - 1 / (1 + .001)
    const capInterval = BigNumber.from(12).toHexString(); // 12 seconds
    const alpha = "0x3ffeef368eb04325c526c2246eec3e55"; // 0.967213114754098360 = 1 - 2 / (1 + blocks) where blocks = 60

    const deployedMockPump = await contract.deploy(maxPctIncrease, maxPctDecrease, capInterval, alpha);

    return new Pump(sdk, deployedMockPump.address, "0x");
  }
}
