/**
 * List of supported chains
 */
var ChainId;
(function (ChainId) {
    ChainId[ChainId["MAINNET"] = 1] = "MAINNET";
    ChainId[ChainId["LOCALHOST"] = 1337] = "LOCALHOST";
})(ChainId || (ChainId = {}));
/**
 * These chains are forks of mainnet,
 * therefore they use the same token addresses as mainnet.
 */
const TESTNET_CHAINS = new Set([ChainId.LOCALHOST]);

class Address {
    constructor(addresses) {
        this.addresses = addresses;
        this.MAINNET = this.addresses[ChainId.MAINNET];
        this.LOCALHOST = this.addresses[ChainId.LOCALHOST];
    }
    static make(input) {
        const addresses = {};
        if (typeof input == "string") {
            addresses[ChainId.MAINNET] = input;
        }
        else {
            Object.assign(addresses, input);
        }
        // Make address values lowercase
        const lowerCaseAddresses = {};
        for (const key in addresses) {
            lowerCaseAddresses[key] = addresses[key].toLowerCase();
        }
        return new Address(lowerCaseAddresses);
    }
    get(chainId) {
        // Default to MAINNET if no chain is specified
        if (!chainId) {
            return this.addresses[ChainId.MAINNET];
        }
        // Throw if user wants a specific chain which we don't support
        if (!ChainId[chainId]) {
            throw new Error(`Chain ID ${chainId} is not supported`);
        }
        // If user wants an address on a TESTNET chain
        // return mainnet one if it's not found
        if (TESTNET_CHAINS.has(chainId)) {
            return this.addresses[chainId] || this.addresses[ChainId.MAINNET];
        }
        return this.addresses[chainId];
    }
    set(input) {
        const newAddress = Address.make(input);
        Object.assign(this, newAddress);
    }
}

export { Address };
//# sourceMappingURL=Address.esm.js.map
