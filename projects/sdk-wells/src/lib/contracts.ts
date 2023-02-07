import { WellsSDK } from "./WellsSDK";

export class Contracts {
  static sdk: WellsSDK;

  constructor(sdk: WellsSDK) {
    Contracts.sdk = sdk;

    // const beanstalkAddress = sdk.addresses.BEANSTALK.get(sdk.chainId);
    // this.beanstalk = Beanstalk__factory.connect(beanstalkAddress, sdk.providerOrSigner);
  }
}
