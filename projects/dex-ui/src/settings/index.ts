import { Log } from "src/utils/logger";

import { DevSettings } from "./development";
import { ProdSettings } from "./production";

const netlifyContext = import.meta.env.VITE_NETLIFY_CONTEXT;
const netlifyCommitHash = import.meta.env.VITE_COMMIT_HASH;
const netlifyBuildId = import.meta.env.VITE_NETLIFY_BUILD_ID;

export const BASE_SUBGRAPH_URL = "https://graph.bean.money";

export interface SubgraphDexSettings {
  /**
   * Subgraph endpoint for Basin on Arbitrum Mainnet
   */
  SUBGRAPH_URL: string;
  /**
   * Sugraph endpoint for Basin on Ethereum Mainnet
   */
  SUBGRAPH_URL_ETH: string;
  /**
   * Subgraph endpoint for Beanstalk on Arbitrum Mainnet
   */
  BEANSTALK_SUBGRAPH_URL: string;
  /**
   * Subgraph endpoint for Beanstalk on Ethereum Mainnet
   */
  BEANSTALK_SUBGRAPH_URL_ETH: string;
};

export interface EnvDexSettings {
  /**
   * 
   */
  PRODUCTION: boolean;
  /**
   * 
   */
  WELLS_ORIGIN_BLOCK: number;
  /**
   * 
   */
  LOAD_HISTORY_FROM_GRAPH: boolean;
};

export interface DexSettings extends SubgraphDexSettings, EnvDexSettings {
  NETLIFY_CONTEXT?: string;
  NETLIFY_COMMIT_HASH?: string;
  NETLIFY_BUILD_ID?: string;
};

export const isDeployPreview = netlifyContext === "deploy-preview";

const envSettings: EnvDexSettings =
  netlifyContext === "production" || isDeployPreview
    ? ProdSettings
    : DevSettings;

const subgraphSettings: SubgraphDexSettings = {
  SUBGRAPH_URL: `${BASE_SUBGRAPH_URL}/basin`,
  SUBGRAPH_URL_ETH: `${BASE_SUBGRAPH_URL}/basin_eth`,
  BEANSTALK_SUBGRAPH_URL: `${BASE_SUBGRAPH_URL}/beanstalk`,
  BEANSTALK_SUBGRAPH_URL_ETH: `${BASE_SUBGRAPH_URL}/beanstalk_eth`,
};

export const Settings = {
  ...envSettings,
  ...subgraphSettings,
  NETLIFY_CONTEXT: netlifyContext,
  NETLIFY_COMMIT_HASH: netlifyCommitHash,
  NETLIFY_BUILD_ID: netlifyBuildId
};

export const isDEV = !Settings.PRODUCTION && !isDeployPreview;

export const isPROD = Settings.PRODUCTION;

// @ts-ignore
globalThis.settings = () => Log.module("settings").log(Settings);
