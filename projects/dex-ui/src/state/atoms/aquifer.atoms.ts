import { atom } from "jotai";

import { Aquifer } from "@beanstalk/sdk-wells";

import { isDEV } from "src/settings";

export const aquiferAtom = atom<Aquifer | null>(null);

if (isDEV) {
  aquiferAtom.debugLabel = "aquifer";
}
