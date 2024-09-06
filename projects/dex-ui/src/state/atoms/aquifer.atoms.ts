import { Aquifer } from "@beanstalk/sdk-wells";
import { atom } from "jotai";

export const aquiferAtom = atom<Aquifer | null>(null);
