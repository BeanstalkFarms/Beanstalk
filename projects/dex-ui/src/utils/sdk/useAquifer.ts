import { Aquifer } from "@beanstalk/sdk-wells";
import { useContext, useMemo } from "react";
import { BeanstalkSDKContext } from "./SdkProvider";

export default function useAquifer(): Aquifer {
  const context = useContext(BeanstalkSDKContext);
  const aquifer = useMemo(() => context.aquifer, [context.aquifer]);

  if (!context || !context.sdk || !aquifer) {
    throw new Error("Expected aquifer to be used within BeanstalkSDK context");
  }

  return aquifer;
}
