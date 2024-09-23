/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   *
   */
  readonly VITE_ALCHEMY_API_KEY: string;

  /**
   * When truthy, show dev chains as selectable options
   * within the Network Dialog.
   */
  readonly VITE_SHOW_DEV_CHAINS?: boolean;

  /**
   * API key for decentralized network subgraph
   */
  readonly VITE_THEGRAPH_API_KEY: string;

  /**
   * If set, don't add CSP meta tag
   */
  readonly DISABLE_CSP?: any;

  /**
   * API key for used for ZeroX Swap API
   */
  readonly VITE_ZERO_X_API_KEY: string;

  /**
   *
   */
  readonly VITE_TENDERLY_ACCOUNT_SLUG: string;

  /**
   *
   */
  readonly VITE_TENDERLY_PROJECT_SLUG: string;

  /**
   *
   */
  readonly VITE_TENDERLY_ACCESS_KEY: string;

  /**
   * Tenderly Virtual Network ID for testnet
   */
  readonly VITE_TENDERLY_VNET_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
