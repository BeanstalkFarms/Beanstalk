import { ChainId, TESTNET_CHAINS } from "@beanstalk/sdk-core";

export type AddressDefinition = {
  [id: number]: string;
};

export class Address {
  private addresses: AddressDefinition;
  public MAINNET: string;
  public TESTNET: string;
  public LOCALHOST: string;

  static make<T extends string | AddressDefinition>(input: T): Address {
    const addresses: AddressDefinition = {};
    if (typeof input == "string") {
      addresses[ChainId.MAINNET] = input;
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
    this.MAINNET = this.addresses[ChainId.MAINNET];
    this.TESTNET = this.addresses[ChainId.TESTNET];
    this.LOCALHOST = this.addresses[ChainId.LOCALHOST];
  }

  get(chainId?: number) {
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

  set<T extends string | AddressDefinition>(input: T) {
    const newAddress = Address.make(input);
    Object.assign(this, newAddress);
  }
}
