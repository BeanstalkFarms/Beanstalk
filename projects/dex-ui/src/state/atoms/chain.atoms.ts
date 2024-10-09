import { atom, useAtomValue, useSetAtom } from "jotai";

export enum ChainIdError {
  INCORRECT = "INCORRECT",
  INVALID = "UNKNOWN",
  WELL_WRONG_NETWORK = "WELL_WRONG_NETWORK"
}

const chainErrAtomn = atom<ChainIdError | null>(null);

const chainErrExistsAtom = atom((get) => !!get(chainErrAtomn));

export const useChainErrExists = () => {
  return useAtomValue(chainErrExistsAtom);
};

export const useChainErr = () => {
  return useAtomValue(chainErrAtomn);
};

export const useSetChainErr = () => {
  return useSetAtom(chainErrAtomn);
};
