/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * 
   */
  readonly VITE_ALCHEMY_API_KEY: string

  /**
   * When truthy, show dev chains as selectable options
   * within the Network Dialog.
   */
  readonly VITE_SHOW_DEV_CHAINS?: boolean

  /**
   * [Dev only] Impersonate another account.
   * Only works with local forked nodes.
   */
  readonly VITE_OVERRIDE_FARMER_ACCOUNT?: string

  /**
   * API key for decentralized network subgraph
   */
  readonly VITE_THEGRAPH_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
