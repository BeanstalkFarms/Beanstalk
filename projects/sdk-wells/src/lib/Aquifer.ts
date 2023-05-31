import { Aquifer as AquiferContract, Aquifer__factory, Well } from "src/constants/generated";
import { setReadOnly } from "./utils";
import { WellsSDK } from "./WellsSDK";

export class Aquifer {
  public sdk: WellsSDK;
  readonly address: string;
  readonly contract: AquiferContract;

  constructor(sdk: WellsSDK, address: string) {
    if (!address) {
      throw new Error("Address must be provided");
    }

    this.address = address;
    setReadOnly(this, "sdk", sdk, false);
    setReadOnly(this, "contract", Aquifer__factory.connect(address, sdk.providerOrSigner), true);
  }

  async boreWell(wellAddress: string, immutableData: Uint8Array, initFunctionCall: Uint8Array, salt: string): Promise<string> {
    const deployedWell = await this.contract.boreWell(wellAddress, immutableData, initFunctionCall, salt);
    const txn = await deployedWell.wait();
    if (!txn.events) {
      throw new Error("No events found");
    }
    return txn.events[0].address;
  }

  static async BuildAquifer(sdk: WellsSDK): Promise<Aquifer> {
    const aquiferContract = new Aquifer__factory(sdk.signer);
    const deployedAquifer = await aquiferContract.deploy();
    return new Aquifer(sdk, deployedAquifer.address);
  }
}
