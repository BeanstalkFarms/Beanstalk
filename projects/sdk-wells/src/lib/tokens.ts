import { Token, ERC20Token, NativeToken } from "@beanstalk/sdk-core";
import { WellsSDK } from "./WellsSDK";

export type TokenSTokensymbol = {
  [symbol: string]: Token;
};

export class Tokens {
  private static sdk: WellsSDK;

  private tokens = new Set<Token>();

  ETH: NativeToken;
  WETH: ERC20Token;
  BEAN: ERC20Token;
  USDC: ERC20Token;
  DAI: ERC20Token;
  USDT: ERC20Token;

  constructor(sdk: WellsSDK) {
    Tokens.sdk = sdk;

    const cid = Tokens.sdk.chainId;
    const provider = Tokens.sdk.providerOrSigner;

    // ETH
    this.ETH = new NativeToken(cid, null, 18, "ETH", { name: "Ether", displayDecimals: 4 }, provider);
    this.tokens.add(this.ETH);

    // WETH
    this.WETH = new ERC20Token(
      cid,
      sdk.addresses.WETH.get(cid),
      18,
      "WETH",
      {
        name: "Wrapped Ether",
        displayDecimals: 4
      },
      provider
    );
    this.tokens.add(this.WETH);

    // BEAN
    this.BEAN = new ERC20Token(
      cid,
      sdk.addresses.BEAN.get(Tokens.sdk.chainId),
      6,
      "BEAN",
      {
        name: "Bean",
        displayDecimals: 2
      },
      provider
    );
    this.tokens.add(this.BEAN);

    // USDC
    this.USDC = new ERC20Token(
      cid,
      sdk.addresses.USDC.get(Tokens.sdk.chainId),
      6,
      "USDC",
      {
        name: "USD Coin",
        displayDecimals: 2
      },
      provider
    );

    this.tokens.add(this.USDC);

    // DAI
    this.DAI = new ERC20Token(
      cid,
      sdk.addresses.DAI.get(Tokens.sdk.chainId),
      18,
      "DAI",
      {
        name: "Dai Stablecoin",
        displayDecimals: 4
      },
      provider
    );

    this.tokens.add(this.DAI);

    // USDT
    this.USDT = new ERC20Token(
      cid,
      sdk.addresses.USDT.get(Tokens.sdk.chainId),
      6,
      "USDT",
      {
        name: "Tether USD",
        displayDecimals: 2
      },
      provider
    );

    this.tokens.add(this.USDT);
  }

  /**
   * Find a token by address
   */
  findByAddress(address: string): Token | undefined {
    for (const token of this.tokens) {
      if (token.address === address.toLowerCase()) return token;
    }
    return;
  }

  /**
   * Find a Token by symbol
   */
  findBySymbol(symbol: string): Token | undefined {
    for (const token of this.tokens) {
      if (token.symbol === symbol) return token;
    }
    return;
  }
}
