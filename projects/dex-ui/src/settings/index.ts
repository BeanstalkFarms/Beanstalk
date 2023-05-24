import { Address } from "src/types";
import { DevSettings } from "./development";
import { ProdSettings } from "./production";
import { Log } from "src/utils/logger";

const netlifyContext = import.meta.env.VITE_NETLIFY_CONTEXT;
const netlifyCommitHash = import.meta.env.VITE_COMMIT_HASH;
const netlifyBuildId = import.meta.env.VITE_NETLIFY_BUILD_ID;

export type DexSettings = {
  PRODUCTION: boolean;
  AQUIFER_ADDRESS: Address;
  SUBGRAPH_URL: string;
  WELLS_ORIGIN_BLOCK: number;
  LOAD_HISTORY_FROM_GRAPH: boolean;
  NETLIFY_CONTEXT: string;
  NETLIFY_COMMIT_HASH: string;
  NETLIFY_BUILD_ID: string;
};

const temp = netlifyContext === "production" ? ProdSettings : DevSettings;

export const Settings = {
  ...temp,
  NETLIFY_CONTEXT: netlifyContext,
  NETLIFY_COMMIT_HASH: netlifyCommitHash,
  NETLIFY_BUILD_ID: netlifyBuildId
};

// @ts-ignore
globalThis.settings = () => Log.module("settings").log(Settings);
