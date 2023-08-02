import { MockPump__factory, MultiFlowPump__factory } from "src/constants/generated";
import { WellsSDK } from "./WellsSDK";

export class Pump {
  constructor(public readonly address: string, public readonly data: string) {}

  static async BuildMockPump(sdk: WellsSDK): Promise<Pump> {
    const mockPumpContract = new MockPump__factory(sdk.signer);
    const deployedMockPump = await mockPumpContract.deploy();
    return new Pump(deployedMockPump.address, "0x");
  }

  static async BuildMultiFlowPump(sdk: WellsSDK): Promise<Pump> {
    const pumpContract = new MultiFlowPump__factory(sdk.signer);
    const deployedPump = await pumpContract.deploy(
      "0x3ffe0000000000000000000000000000", // 0.5
      "0x3ffd555555555555553cbcd83d925070", // 0.333333333333333333
      12,
      "0x3ffecccccccccccccccccccccccccccc" // 0.9
    );
    return new Pump(deployedPump.address, "0x");
  }
}
