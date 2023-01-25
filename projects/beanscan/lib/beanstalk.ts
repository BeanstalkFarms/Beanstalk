import { BeanstalkSDK } from "@beanstalk/sdk";
import { provider } from "./provider";

export default new BeanstalkSDK({
  provider,
});