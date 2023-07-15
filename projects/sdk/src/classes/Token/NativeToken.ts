import { NativeToken as CoreNativeToken } from "@beanstalk/sdk-core";

export type NativeToken = InstanceType<typeof CoreNativeToken>;
export const NativeToken = CoreNativeToken;
