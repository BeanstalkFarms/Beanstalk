import { ChainId, TESTNET_CHAINS } from "src/constants/chains";

export type AddressDefinition = {
  [id: number]: string;
};

export class Address {
  private addresses: AddressDefinition;
  public ARBITRUM_MAINNET: string;
  public ETH_MAINNET: string;
  public LOCALHOST: string;
  public LOCALHOST_ETH: string;
  public ANVIL1: string;
  public TESTNET: string;

  static defaultChainId = ChainId.ARBITRUM_MAINNET;

  private static fallbackChainIds = {
    [ChainId.LOCALHOST_ETH]: ChainId.ETH_MAINNET,
    [ChainId.LOCALHOST]: ChainId.ARBITRUM_MAINNET,
    // anvil1 was originally a mainnet fork, so we use mainnet addresses as fallback
    [ChainId.ANVIL1]: ChainId.ETH_MAINNET,
    [ChainId.TESTNET]: Address.defaultChainId
  };

  // ---------- Static methods ----------

  static setDefaultChainId = (chainId: ChainId) => {
    Address.defaultChainId = chainId;
  };

  static getFallbackChainId(chainId: ChainId) {
    if (chainId in Address.fallbackChainIds) {
      return Address.fallbackChainIds[chainId as keyof typeof Address.fallbackChainIds];
    }

    throw new Error(
      `chainId: ${chainId} could not be found in fallbackChainIds: ${Address.fallbackChainIds}`
    );
  }

  static make<T extends string | AddressDefinition>(input: T): Address {
    const addresses: AddressDefinition = {};
    if (typeof input == "string") {
      addresses[Address.defaultChainId] = input.toLowerCase();
    } else {
      Object.assign(addresses, input);
    }

    // Make address values lowercase
    const lowerCaseAddresses: AddressDefinition = {};
    for (const key in addresses) {
      lowerCaseAddresses[key] = addresses[key].toLowerCase();
    }

    return new Address(lowerCaseAddresses);
  }

  constructor(addresses: AddressDefinition) {
    this.addresses = addresses;

    this.ARBITRUM_MAINNET = this.addresses[ChainId.ARBITRUM_MAINNET];
    this.ETH_MAINNET = this.addresses[ChainId.ETH_MAINNET];
    this.LOCALHOST =
      this.addresses[ChainId.LOCALHOST] ||
      this.addresses[Address.getFallbackChainId(ChainId.LOCALHOST)];
    this.LOCALHOST_ETH =
      this.addresses[ChainId.ETH_MAINNET] ||
      this.addresses[Address.getFallbackChainId(ChainId.LOCALHOST_ETH)];
    this.TESTNET =
      this.addresses[ChainId.TESTNET] ||
      this.addresses[Address.getFallbackChainId(ChainId.TESTNET)];
    this.ANVIL1 =
      this.addresses[ChainId.ANVIL1] || this.addresses[Address.getFallbackChainId(ChainId.ANVIL1)];
  }

  get(chainId?: number) {
    // Default to Address.defaultChainId if no chain is specified
    if (!chainId) {
      return this.addresses[Address.defaultChainId];
    }

    // Throw if user wants a specific chain which we don't support
    if (!ChainId[chainId]) {
      throw new Error(`Chain ID ${chainId} is not supported`);
    }

    // If user wants an address on a TESTNET chain.
    // return Address.defaultChainId one if it's not found
    if (TESTNET_CHAINS.has(chainId)) {
      return (
        this.addresses[chainId] ||
        this.addresses[Address.getFallbackChainId(chainId)] ||
        this.addresses[Address.defaultChainId]
      );
    }

    return this.addresses[chainId];
  }

  set<T extends string | AddressDefinition>(input: T) {
    const newAddress = Address.make(input);
    Object.assign(this, newAddress);
  }
}
