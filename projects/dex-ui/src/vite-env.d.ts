/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * aquifer address for arbitrum mainnet
   */
  readonly VITE_AQUIFER_ADDRESS_ARBITRUM: string;

  /**
   * aquifer address for eth mainnet
   */
  readonly VITE_AQUIFER_ADDRESS_ETH: string;

  /**
   * API key for alchemy
   */
  readonly VITE_ALCHEMY_API_KEY: string;

  /**
   * API key for decentralized network subgraph
   */
  readonly VITE_THEGRAPH_API_KEY: number;

  /**
   * Wallet connect project ID
   */
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;

  /**
   * Whether we are before the BS3 deploy
   */
  readonly VITE_BS3_DEPLOYED?: boolean;

  /**
   *
   */
  readonly VITE_WELLS_ORIGIN_BLOCK: string;

  /**
   *
   */
  readonly VITE_LOAD_HISTORY_FROM_GRAPH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
