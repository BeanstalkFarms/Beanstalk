import { MockPump__factory } from "src/constants/generated";
import { WellsSDK } from "./WellsSDK";

export class Pump {
  constructor(public readonly address: string, public readonly data: string) {}

  static async BuildMockPump(sdk: WellsSDK): Promise<Pump> {
    const mockPumpContract = new MockPump__factory(sdk.signer);
    const deployedMockPump = await mockPumpContract.deploy();
    return new Pump(deployedMockPump.address, "0x");
  }
}
