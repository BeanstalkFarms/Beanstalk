import { useAtomValue } from "jotai";

import { BeanstalkSDK } from "@beanstalk/sdk";

import { sdkAtom } from "src/state/providers/SdkProvider";

export default function useSdk(): BeanstalkSDK {
  const sdk = useAtomValue(sdkAtom);
  if (!sdk) {
    throw new Error("Expected sdk to be used within BeanstalkSDK context");
  }

  return sdk;
}
