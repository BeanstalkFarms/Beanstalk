import { Log } from "src/utils/logger";

import { DevSettings } from "./development";
import { ProdSettings } from "./production";

const netlifyContext = import.meta.env.VITE_NETLIFY_CONTEXT;
const netlifyCommitHash = import.meta.env.VITE_COMMIT_HASH;
const netlifyBuildId = import.meta.env.VITE_NETLIFY_BUILD_ID;

export const BASE_SUBGRAPH_URL = "https://graph.bean.money";

export type DexSettings = {
  PRODUCTION: boolean;
  SUBGRAPH_URL: string;
  SUBGRAPH_URL_ETH: string;
  BEANSTALK_SUBGRAPH_URL: string;
  BEANSTALK_SUBGRAPH_URL_ETH: string;
  WELLS_ORIGIN_BLOCK: number;
  LOAD_HISTORY_FROM_GRAPH: boolean;
  NETLIFY_CONTEXT?: string;
  NETLIFY_COMMIT_HASH?: string;
  NETLIFY_BUILD_ID?: string;
};

const baseSettings =
  netlifyContext === "production" || netlifyContext === "deploy-preview"
    ? ProdSettings
    : DevSettings;

export const Settings = {
  ...baseSettings,
  NETLIFY_CONTEXT: netlifyContext,
  NETLIFY_COMMIT_HASH: netlifyCommitHash,
  NETLIFY_BUILD_ID: netlifyBuildId
};

export const isDeployPreview = netlifyContext === "deploy-preview";

export const isDEV = !Settings.PRODUCTION && !isDeployPreview;

export const isPROD = Settings.PRODUCTION;

// @ts-ignore
globalThis.settings = () => Log.module("settings").log(Settings);
