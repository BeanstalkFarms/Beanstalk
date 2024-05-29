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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
