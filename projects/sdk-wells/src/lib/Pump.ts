import { MultiFlowPump__factory, MockPump__factory } from "src/constants/generated";
import { WellsSDK } from "./WellsSDK";
import { setReadOnly } from "./utils";

export class Pump {
  readonly sdk: WellsSDK;
  readonly contract: MultiFlowPump__factory;
  readonly address: string;

  constructor(sdk: WellsSDK, address: string) {
    this.address = address;
    setReadOnly(this, "sdk", sdk, false);
    const contract = MultiFlowPump__factory.connect(address, sdk.providerOrSigner);
    setReadOnly(this, "contract", contract, true);
  }

  static async BuildMockPump(sdk: WellsSDK): Promise<Pump> {
    const mockPumpContract = new MockPump__factory(sdk.signer);
    const deployedMockPump = await mockPumpContract.deploy();

    return new Pump(sdk, deployedMockPump.address);
  }

  static async BuildMultiFlowPump(sdk: WellsSDK): Promise<Pump> {
    const contract = new MultiFlowPump__factory(sdk.signer);

    // TODO: these are dummy values, this method isn't used yet.
    // these will need to be passed in as params and converted to bytelike or whatever
    const inc = "0x";
    const dec = "0x";
    const cap = "0x";
    const alpha = "0x";
    const deployedMockPump = await contract.deploy(inc, dec, cap, alpha);
    return new Pump(sdk, deployedMockPump.address);
  }
}
