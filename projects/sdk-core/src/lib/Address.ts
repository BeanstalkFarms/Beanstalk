import { ChainId } from "src/constants/chains";
import { ChainResolver } from "src/lib/ChainResolver";

export type AddressDefinition = Record<number, string>;

export class Address {
  private addresses: AddressDefinition;

  static make<T extends string | AddressDefinition>(input: T): Address {
    const addresses: AddressDefinition =
      typeof input === "string" ? { [ChainResolver.defaultChainId]: input } : input;

    return new Address(addresses);
  }

  constructor(addresses: AddressDefinition) {
    this.addresses = Object.fromEntries(
      Object.entries(addresses).map(([key, value]) => [Number(key), value.toLowerCase()])
    );
  }

  get(chainId: number = ChainResolver.defaultChainId) {
    ChainResolver.validateChainId(chainId);

    if (ChainResolver.isTestnet(chainId)) {
      // return the address for the chainId if it exists.
      if (this.addresses[chainId]) {
        return this.addresses[chainId];
      }

      // return the address for this chainId's mainnet counterpart.
      return this.addresses[ChainResolver.resolveToMainnetChainId(chainId)];
    }

    return this.addresses[chainId];
  }

  set<T extends string | AddressDefinition>(input: T) {
    const newAddress = Address.make(input);
    Object.assign(this.addresses, newAddress.addresses);
  }

  get ARBITRUM_MAINNET(): string {
    return this.get(ChainId.ARBITRUM_MAINNET);
  }
  get ETH_MAINNET(): string {
    return this.get(ChainId.ETH_MAINNET);
  }
  get LOCALHOST(): string {
    return this.get(ChainId.LOCALHOST);
  }
  get LOCALHOST_ETH(): string {
    return this.get(ChainId.LOCALHOST_ETH);
  }
  get TESTNET(): string {
    return this.get(ChainId.TESTNET);
  }
  get ANVIL1(): string {
    return this.get(ChainId.ANVIL1);
  }
}
