/**
 * List of supported chains
 */
export declare enum ChainId {
    MAINNET = 1,
    LOCALHOST = 1337
}
/**
 * These chains are forks of mainnet,
 * therefore they use the same token addresses as mainnet.
 */
export declare const TESTNET_CHAINS: Set<ChainId>;
