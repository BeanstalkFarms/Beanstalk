import { BeanstalkSDK } from "@beanstalk/sdk";
import { useContext, useMemo } from "react";
import { BeanstalkSDKContext } from "src/utils/sdk/SdkProvider";

export default function useSdk(): BeanstalkSDK {
  const sdk = useContext(BeanstalkSDKContext);
  if (!sdk.sdk) {
    throw new Error("Expected sdk to be used within BeanstalkSDK context");
  }

  return useMemo(() => sdk.sdk, [sdk.sdk]);
}