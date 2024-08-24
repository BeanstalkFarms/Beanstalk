import { ChainId, TESTNET_CHAINS } from "src/constants/chains";

export type AddressDefinition = {
  [id: number]: string;
};

export class Address {
  private addresses: AddressDefinition;
  public MAINNET: string;
  public LOCALHOST: string;
  public ANVIL1: string;

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
    this.LOCALHOST = this.addresses[ChainId.LOCALHOST];
    this.ANVIL1 = this.addresses[ChainId.ANVIL1];
  }

  get(chainId?: number) {
    let address: string = this.addresses[ChainId.ARBITRUM];

    // Default to ARBITRUM if no chain is specified
    if (!chainId) {
      if (!address) {
        throw new Error(
         `Chain ID ${ChainId.ARBITRUM} not supported in address definition: ${this.addresses}`
        );
      }
      return address;
    }

    // Throw if user wants a specific chain which we don't support
    if (!ChainId[chainId]) {
      throw new Error(`Chain ID ${chainId} is not supported`);
    }

    // If user wants an address on a TESTNET chain
    // return ARBITRUM one if it's not found
    if (TESTNET_CHAINS.has(chainId)) {
      address = this.addresses[chainId] || this.addresses[ChainId.ARBITRUM];
    } else {
      address = this.addresses[chainId];
    }

    if (!address) {
      throw new Error(
        `Chain ID not supported in address definition: ${this.addresses}`
      );
    }

    return this.addresses[chainId];
  }

  set<T extends string | AddressDefinition>(input: T) {
    const newAddress = Address.make(input);
    Object.assign(this, newAddress);
  }
}
