import { ERC20Token } from "@beanstalk/sdk-core";
import { Auger as AugerContract, Auger__factory } from "src/constants/generated";
import { WellsSDK } from "./WellsSDK";


export class Auger {
  public sdk: WellsSDK;
  readonly address: string;
  readonly contract: AugerContract;

  constructor(sdk: WellsSDK, address: string) {
    if (!address) {
      throw new Error("Address must be provided");
    }
    Object.defineProperty(this, "sdk", {
      value: sdk
    });
    this.address = address;
    Object.defineProperty(this, "contract", {
      value: Auger__factory.connect(address, sdk.providerOrSigner)
    });
  }

  // TODO Fill out

}