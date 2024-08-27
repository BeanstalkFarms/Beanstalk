import { ChainId, TESTNET_CHAINS } from "src/constants/chains";

export type AddressDefinition = {
  [id: number]: string;
};

export class Address {
  private addresses: AddressDefinition;
  public MAINNET: string;
  public ARBITRUM: string;
  public LOCALHOST: string;
  public LOCALHOST_ARBITRUM: string;
  public ANVIL1: string;
  public TESTNET: string;

  static defaultChainId = ChainId.ARBITRUM;

  static setDefaultChainId = (chainId: ChainId) => {
    Address.defaultChainId = chainId;
  };

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

    this.ARBITRUM = this.addresses[ChainId.ARBITRUM];
    this.LOCALHOST_ARBITRUM = this.addresses[ChainId.LOCALHOST_ARBITRUM] || this.ARBITRUM;

    this.MAINNET = this.addresses[ChainId.MAINNET];
    this.LOCALHOST = this.addresses[ChainId.LOCALHOST] || this.MAINNET;

    this.TESTNET = this.addresses[ChainId.TESTNET] || this.addresses[Address.defaultChainId];
    this.ANVIL1 = this.addresses[ChainId.ANVIL1] || this.addresses[Address.defaultChainId];
  }

  get(chainId?: number) {
    const defaultAddress = this.addresses[Address.defaultChainId] || "";

    let address = defaultAddress;

    // Default to Address.defaultChainId if no chain is specified
    if (!chainId) {
      return address;
    }

    // Throw if user wants a specific chain which we don't support
    if (!ChainId[chainId]) {
      throw new Error(`Chain ID ${chainId} is not supported`);
    }

    // If user wants an address on a TESTNET chain
    // return ARBITRUM one if it's not found
    if (TESTNET_CHAINS.has(chainId)) {
      address = this.addresses[chainId] || defaultAddress;
    } else {
      address = this.addresses[chainId] || defaultAddress;
    }

    return address;
  }

  set<T extends string | AddressDefinition>(input: T) {
    const newAddress = Address.make(input);
    Object.assign(this, newAddress);
  }
}
