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
  public TESTNET: string;

  static make<T extends string | AddressDefinition>(input: T): Address {
    const addresses: AddressDefinition = {};
    if (typeof input == "string") {
      addresses[ChainId.ARBITRUM] = input.toLowerCase();
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
    this.MAINNET = this.addresses[ChainId.MAINNET];
    this.LOCALHOST_ARBITRUM =
      this.addresses[ChainId.LOCALHOST_ARBITRUM] || this.addresses[ChainId.ARBITRUM];
    this.TESTNET = this.addresses[ChainId.TESTNET];
    this.LOCALHOST = this.addresses[ChainId.LOCALHOST] || this.addresses[ChainId.MAINNET];
  }

  get(chainId?: number) {
    let address = this.addresses[ChainId.ARBITRUM];

    // Default to ARBITRUM if no chain is specified
    if (!chainId) {
      return address || "";
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

    return address || "";
  }

  set<T extends string | AddressDefinition>(input: T) {
    const newAddress = Address.make(input);
    Object.assign(this, newAddress);
  }
}
