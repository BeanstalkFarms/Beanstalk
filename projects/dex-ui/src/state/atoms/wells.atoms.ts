import { atom } from "jotai";

import { Well } from "@beanstalk/sdk-wells";

import { isDEV } from "src/settings";
import { AddressMap } from "src/types";

export const wellsAtom = atom<{
  data: Well[];
  error: Error | null;
  isLoading: boolean;
}>({ data: [], error: null, isLoading: true });

export const wellsByAddressAtom = atom((get) =>
  get(wellsAtom).data.reduce<AddressMap<Well>>((acc, well) => {
    acc[well.address.toLowerCase()] = well;
    return acc;
  }, {})
);

export const setWellsLoadingAtom = atom(null, (get, set, isLoading: boolean) => {
  const wells = get(wellsAtom);
  set(wellsAtom, { ...wells, isLoading: isLoading });
});

// set debug labels
if (isDEV) {
  wellsAtom.debugLabel = "wells";
  wellsByAddressAtom.debugLabel = "wells/wellsByAddress";
  setWellsLoadingAtom.debugLabel = "wells/setWellsLoading";
}
