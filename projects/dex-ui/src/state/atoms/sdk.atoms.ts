import { atom } from "jotai";

import { BeanstalkSDK } from "@beanstalk/sdk";

import { isDEV } from "src/settings";

export const sdkAtom = atom<BeanstalkSDK | null>(null);

if (isDEV) {
  sdkAtom.debugLabel = "sdk";
}
