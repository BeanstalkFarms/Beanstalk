import { BeanstalkSDK } from "./BeanstalkSDK";

export class Sun {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    Sun.sdk = sdk;
  }

  async getSeason(): Promise<number> {
    return Sun.sdk.contracts.beanstalk.season();
  }

  // ... other sun related things
}
