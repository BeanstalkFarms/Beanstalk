import { ERC20Token } from "@beanstalk/sdk-core";
import { Aquifer as AquiferContract, Aquifer__factory } from "src/constants/generated";
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
    setReadOnly(this, 'sdk', sdk, false)
    setReadOnly(this, 'contract', Aquifer__factory.connect(address, sdk.providerOrSigner), true)
  }

}