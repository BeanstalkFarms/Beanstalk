import { ContractTransaction } from "ethers";
import { BeanstalkSDK } from "./BeanstalkSDK";

export class Sun {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    Sun.sdk = sdk;
  }

  async getSeason(): Promise<number> {
    return Sun.sdk.contracts.beanstalk.season();
  }

  async sunrise(): Promise<ContractTransaction> {
    return Sun.sdk.contracts.beanstalk.sunrise();
  }
}
