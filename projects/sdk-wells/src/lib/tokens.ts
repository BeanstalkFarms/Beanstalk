import { Token, ERC20Token, NativeToken } from "@beanstalk/sdk-core";
import { WellsSDK } from "./WellsSDK";

export type TokenSTokensymbol = {
  [symbol: string]: Token;
};

export class Tokens {
  private static sdk: WellsSDK;

  private tokens = new Set<Token>();

  private tokenMap = new Map<string, Token>();

  readonly erc20Tokens = new Map<string, ERC20Token>();

  ETH: NativeToken;
  WETH: ERC20Token;
  BEAN: ERC20Token;
  USDC: ERC20Token;
  DAI: ERC20Token;
  USDT: ERC20Token;
  WSTETH: ERC20Token;
  WEETH: ERC20Token;
  WBTC: ERC20Token;

  constructor(sdk: WellsSDK) {
    Tokens.sdk = sdk;

    const cid = Tokens.sdk.chainId;
    const provider = Tokens.sdk.providerOrSigner;

    // ---------- Native Tokens ----------
    // ETH
    this.ETH = new NativeToken(
      cid,
      null,
      18,
      "ETH",
      { name: "Ether", displayDecimals: 4 },
      provider
    );
    this.tokens.add(this.ETH);

    // ---------- ERC20 Tokens ----------

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

    // WSTETH
    this.WSTETH = new ERC20Token(
      cid,
      sdk.addresses.WSTETH.get(),
      18,
      "wstETH",
      {
        name: "Wrapped liquid staked Ether 2.0",
        displayDecimals: 4
      },
      provider
    );

    this.tokens.add(this.WSTETH);

    // weETH
    this.WEETH = new ERC20Token(
      cid,
      sdk.addresses.WEETH.get(cid),
      18,
      "weETH",
      {
        name: "Wrapped eETH",
        displayDecimals: 4
      },
      provider
    );

    this.tokens.add(this.WEETH);

    // WBTC
    this.WBTC = new ERC20Token(
      cid,
      sdk.addresses.WBTC.get(cid),
      8,
      "WBTC",
      {
        name: "Wrapped BTC",
        displayDecimals: 6
      },
      provider
    );

    this.tokens.add(this.WBTC);

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

    this.tokenMap = new Map();
    this.erc20Tokens = new Map();

    this.tokens.forEach((token) => {
      this.tokenMap.set(token.address.toLowerCase(), token);
      if (token instanceof ERC20Token) {
        this.erc20Tokens.set(token.address.toLowerCase(), token);
      }
    });
  }

  /**
   * Find a token by address
   */
  findByAddress(address: string): Token | undefined {
    return this.tokenMap.get(address.toLowerCase());
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
