import { BeanstalkSDK } from "@beanstalk/sdk";
import { useAtom } from "jotai";
import { useMemo } from "react";
import { sdkAtom } from "src/state/providers/SdkProvider";

export default function useSdk(): BeanstalkSDK {
  const [sdk] = useAtom(sdkAtom);
  if (!sdk) {
    throw new Error("Expected sdk to be used within BeanstalkSDK context");
  }

  return useMemo(() => sdk, [sdk]);
}
