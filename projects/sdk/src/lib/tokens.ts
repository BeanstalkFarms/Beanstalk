import { addresses, ZERO_BN } from "src/constants";
import { Token, BeanstalkToken, ERC20Token, NativeToken } from "src/classes/Token";
import { BeanstalkSDK } from "./BeanstalkSDK";
import { EIP2612PermitMessage, EIP712Domain, EIP712TypedData, Permit } from "./permit";
import { TokenValue } from "@beanstalk/sdk-core";
import { BigNumber } from "ethers";

export type TokenBalance = {
  internal: TokenValue;
  external: TokenValue;
  total: TokenValue;
};

export class Tokens {
  private sdk: BeanstalkSDK;
  public readonly ETH: NativeToken;
  public readonly WETH: ERC20Token;
  public readonly BEAN: ERC20Token;
  public readonly ROOT: ERC20Token;
  public readonly CRV3: ERC20Token;
  public readonly DAI: ERC20Token;
  public readonly USDC: ERC20Token;
  public readonly USDT: ERC20Token;
  public readonly LUSD: ERC20Token;
  public readonly BEAN_ETH_UNIV2_LP: ERC20Token;
  public readonly BEAN_CRV3_LP: ERC20Token;
  public readonly UNRIPE_BEAN: ERC20Token;
  public readonly UNRIPE_BEAN_CRV3: ERC20Token;
  public readonly STALK: BeanstalkToken;
  public readonly SEEDS: BeanstalkToken;
  public readonly PODS: BeanstalkToken;
  public readonly SPROUTS: BeanstalkToken;
  public readonly RINSABLE_SPROUTS: BeanstalkToken;

  public unripeTokens: Set<Token>;
  public unripeUnderlyingTokens: Set<Token>;
  public siloWhitelist: Set<Token>;
  public erc20Tokens: Set<Token>;
  public balanceTokens: Set<Token>;
  public crv3Underlying: Set<Token>;

  private map: Map<string, Token>;

  constructor(sdk: BeanstalkSDK) {
    this.sdk = sdk;
    this.map = new Map();

    ////////// Ethereum //////////
    const chainId = this.sdk.chainId;
    const providerOrSigner = this.sdk.providerOrSigner;

    this.ETH = new NativeToken(
      chainId,
      null,
      18,
      "ETH",
      {
        name: "Ether",
        displayDecimals: 4
      },
      providerOrSigner
    );

    this.WETH = new ERC20Token(
      chainId,
      addresses.WETH.get(chainId),
      18,
      "WETH",
      {
        name: "Wrapped Ether"
      },
      providerOrSigner
    );

    this.map.set("eth", this.ETH);
    this.map.set(addresses.WETH.get(chainId), this.WETH);

    ////////// Beanstalk //////////

    this.STALK = new BeanstalkToken(
      chainId,
      null,
      10,
      "STALK",
      {
        name: "Stalk"
      },
      providerOrSigner
    );

    this.SEEDS = new BeanstalkToken(
      chainId,
      null,
      6,
      "SEED",
      {
        name: "Seeds"
      },
      providerOrSigner
    );

    this.BEAN = new ERC20Token(
      chainId,
      addresses.BEAN.get(chainId),
      6,
      "BEAN",
      {
        name: "Bean",
        displayName: "Bean"
      },
      providerOrSigner
    );
    this.BEAN.rewards = {
      stalk: this.STALK.amount(1),
      seeds: this.SEEDS.amount(2)
    };

    this.BEAN_CRV3_LP = new ERC20Token(
      chainId,
      addresses.BEAN_CRV3.get(chainId),
      18,
      "BEAN3CRV",
      {
        name: "Curve.fi Factory USD Metapool: Bean", // see .name()
        displayName: "BEAN:3CRV LP",
        isLP: true,
        color: "#DFB385"
      },
      providerOrSigner
    );
    this.BEAN_CRV3_LP.rewards = {
      stalk: this.STALK.amount(1),
      seeds: this.SEEDS.amount(4)
    };

    this.UNRIPE_BEAN = new ERC20Token(
      chainId,
      addresses.UNRIPE_BEAN.get(chainId),
      6,
      "urBEAN",
      {
        name: "Unripe Bean", // see `.name()`
        displayName: "Unripe Bean",
        displayDecimals: 2
      },
      providerOrSigner
    );
    this.UNRIPE_BEAN.rewards = {
      stalk: this.STALK.amount(1),
      seeds: this.SEEDS.amount(2)
    };
    this.UNRIPE_BEAN.isUnripe = true;

    this.UNRIPE_BEAN_CRV3 = new ERC20Token(
      chainId,
      addresses.UNRIPE_BEAN_CRV3.get(chainId),
      6,
      "urBEAN3CRV",
      {
        name: "Unripe BEAN3CRV", // see `.name()`
        displayName: "Unripe BEAN:3CRV LP",
        displayDecimals: 2
      },
      providerOrSigner
    );
    this.UNRIPE_BEAN_CRV3.rewards = {
      stalk: this.STALK.amount(1),
      seeds: this.SEEDS.amount(4)
    };
    this.UNRIPE_BEAN_CRV3.isUnripe = true;

    this.map.set(addresses.BEAN.get(chainId), this.BEAN);
    this.map.set(addresses.BEAN_CRV3.get(chainId), this.BEAN_CRV3_LP);
    this.map.set(addresses.UNRIPE_BEAN.get(chainId), this.UNRIPE_BEAN);
    this.map.set(addresses.UNRIPE_BEAN_CRV3.get(chainId), this.UNRIPE_BEAN_CRV3);

    ////////// Beanstalk "Tokens" (non ERC-20) //////////

    this.PODS = new BeanstalkToken(
      chainId,
      null,
      6,
      "PODS",
      {
        name: "Pods"
      },
      providerOrSigner
    );

    this.SPROUTS = new BeanstalkToken(
      chainId,
      null,
      6,
      "SPROUT",
      {
        name: "Sprouts"
      },
      providerOrSigner
    );

    this.RINSABLE_SPROUTS = new BeanstalkToken(
      chainId,
      null,
      6,
      "rSPROUT",
      {
        name: "Rinsable Sprouts"
      },
      providerOrSigner
    );

    this.map.set("STALK", this.STALK);
    this.map.set("SEED", this.SEEDS);
    this.map.set("PODS", this.PODS);
    this.map.set("SPROUT", this.SPROUTS);
    this.map.set("rSPROUT", this.RINSABLE_SPROUTS);

    ////////// Beanstalk Ecosystem Tokens //////////

    this.ROOT = new ERC20Token(
      chainId,
      addresses.ROOT.get(chainId),
      18,
      "ROOT",
      {
        name: "Root"
      },
      providerOrSigner
    );

    this.map.set(addresses.ROOT.get(chainId), this.ROOT);

    ////////// Common ERC-20 Tokens //////////

    this.CRV3 = new ERC20Token(
      chainId,
      addresses.CRV3.get(chainId),
      18,
      "3CRV",
      {
        name: "3CRV",
        isLP: true
      },
      providerOrSigner
    );

    this.DAI = new ERC20Token(
      chainId,
      addresses.DAI.get(chainId),
      18,
      "DAI",
      {
        name: "Dai"
      },
      providerOrSigner
    );

    this.USDC = new ERC20Token(
      chainId,
      addresses.USDC.get(chainId),
      6,
      "USDC",
      {
        name: "USD Coin"
      },
      providerOrSigner
    );

    this.USDT = new ERC20Token(
      chainId,
      addresses.USDT.get(chainId),
      6,
      "USDT",
      {
        name: "Tether"
      },
      providerOrSigner
    );

    this.LUSD = new ERC20Token(
      chainId,
      addresses.LUSD.get(chainId),
      6,
      "LUSD",
      {
        name: "LUSD"
      },
      providerOrSigner
    );

    this.map.set(addresses.CRV3.get(chainId), this.CRV3);
    this.map.set(addresses.DAI.get(chainId), this.DAI);
    this.map.set(addresses.USDC.get(chainId), this.USDC);
    this.map.set(addresses.USDT.get(chainId), this.USDT);
    this.map.set(addresses.LUSD.get(chainId), this.LUSD);

    ////////// Legacy //////////

    // Keep the old BEAN_ETH and BEAN_LUSD tokens to let
    // the Pick dialog properly display pickable assets.
    this.BEAN_ETH_UNIV2_LP = new ERC20Token(
      chainId,
      addresses.BEAN_ETH_UNIV2_LP.get(chainId),
      18,
      "BEAN:ETH",
      {
        name: "BEAN:ETH LP",
        displayDecimals: 9,
        isLP: true
      },
      providerOrSigner
    );
    this.BEAN_ETH_UNIV2_LP.rewards = {
      stalk: this.STALK.amount(1),
      seeds: this.SEEDS.amount(4)
    };

    this.map.set(addresses.BEAN_ETH_UNIV2_LP.get(chainId), this.BEAN_ETH_UNIV2_LP);

    ////////// Groups //////////

    this.unripeTokens = new Set([this.UNRIPE_BEAN, this.UNRIPE_BEAN_CRV3]);
    this.unripeUnderlyingTokens = new Set([this.BEAN, this.BEAN_CRV3_LP]);
    this.siloWhitelist = new Set([this.BEAN, this.BEAN_CRV3_LP, this.UNRIPE_BEAN, this.UNRIPE_BEAN_CRV3]);
    this.erc20Tokens = new Set([...this.siloWhitelist, this.WETH, this.CRV3, this.DAI, this.USDC, this.USDT]);
    this.balanceTokens = new Set([this.ETH, ...this.erc20Tokens]);
    this.crv3Underlying = new Set([this.DAI, this.USDC, this.USDT]);
  }

  isWhitelisted(token: Token){
    return this.siloWhitelist.has(token)
  }

  // TODO: why do we need this?
  getMap(): Readonly<Map<string, Token>> {
    return Object.freeze(new Map(this.map));
  }

  /**
   * Get a Token by address
   */
  findByAddress(address: string): Token | undefined {
    return this.map.get(address.toLowerCase());
  }

  /**
   * Get a Token by symbol
   */
  findBySymbol(symbol: string): Token | undefined {
    for (const [_, token] of this.map) {
      if (token.symbol === symbol) return token;
    }
    return undefined;
  }

  /**
   * Destruct a string (address) | Token => address
   */
  private deriveAddress(value: string | Token) {
    return typeof value === "string" ? value : value.address;
  }

  /**
   * Destruct a string (address) | Token => [Token, address]
   * Fails if `this.map` doesn't contain the Token.
   */
  private deriveToken(value: string | Token): [Token, string] {
    if (typeof value === "string") {
      const _token = this.findByAddress(value);
      if (!_token) throw new Error(`Unknown token: ${value}`);
      return [_token, value];
    } else if (value?.address) {
      return [value, value.address];
    }
    throw new Error(`Unable to derive token from ${value}`);
  }

  /**
   * Convert TokenFacet.BalanceStructOutput to a TokenBalance.
   */
  private makeTokenBalance(
    token: Token,
    result: {
      internalBalance: BigNumber;
      externalBalance: BigNumber;
      totalBalance: BigNumber;
    }
  ): TokenBalance {
    return {
      internal: token.fromBlockchain(result.internalBalance),
      external: token.fromBlockchain(result.externalBalance),
      total: token.fromBlockchain(result.totalBalance)
    };
  }

  /**
   * Return a TokenBalance for a requested token.
   * Includes the Farmer's INTERNAL and EXTERNAL balance in one item.
   * This is the typical representation of balances within Beanstalk.
   */
  public async getBalance(_token: string | Token, _account?: string): Promise<TokenBalance> {
    const account = await this.sdk.getAccount(_account);

    // ETH cannot be stored in the INTERNAL balance.
    // Here we use the native getBalance() method and cast to a TokenBalance.
    if (_token === this.ETH) {
      const balance = await this.sdk.provider.getBalance(account);
      return this.makeTokenBalance(_token, {
        internalBalance: ZERO_BN,
        externalBalance: balance,
        totalBalance: balance
      });
    }

    // FIXME: use the ERC20 token contract directly to load decimals for parsing?
    const [token, tokenAddress] = this.deriveToken(_token);

    const balance = await this.sdk.contracts.beanstalk.getAllBalance(account, tokenAddress);

    return this.makeTokenBalance(token, balance);
  }

  /**
   * Return a TokenBalance struct for each requested token.
   * Includes the Farmer's INTERNAL and EXTERNAL balance in one item.
   * This is the typical representation of balances within Beanstalk.
   *
   * @todo discuss parameter inversion between getBalance() and getBalances().
   */
  public async getBalances(_account?: string, _tokens?: (string | Token)[]): Promise<Map<Token, TokenBalance>> {
    const account = await this.sdk.getAccount(_account);
    const tokens = _tokens || Array.from(this.erc20Tokens); // is this a good default?
    const tokenAddresses = tokens.map(this.deriveAddress);

    // FIXME: only allow ERC20 tokens with getBalance() method, or
    // override if token is NativeToken
    const balances = new Map<Token, TokenBalance>();
    const results = await this.sdk.contracts.beanstalk.getAllBalances(account, tokenAddresses);

    results.forEach((result, index) => {
      const token = this.findByAddress(tokenAddresses[index]);

      // FIXME: use the ERC20 token contract directly to load decimals for parsing?
      if (!token) throw new Error(`Unknown token: ${tokenAddresses}`);

      balances.set(token, this.makeTokenBalance(token, result));
    });

    return balances;
  }

  //////////////////////// Permit Data ////////////////////////

  /**
   * Create the domain for an particular ERC-2636 signature.
   * Look up the name of an ERC-20 token for signing.
   *
   * @ref https://github.com/dmihal/eth-permit/blob/34f3fb59f0e32d8c19933184f5a7121ee125d0a5/src/eth-permit.ts#L85
   */
  private async getEIP712DomainForToken(token: ERC20Token): Promise<EIP712Domain> {
    const [name, chainId] = await Promise.all([token.getName(), this.sdk.provider.getNetwork().then((network) => network.chainId)]);
    return {
      name,
      version: "1",
      chainId,
      verifyingContract: token.address
    };
  }

  //////////////////////// PERMIT: ERC-2612 (for other ERC-20 tokens) ////////////////////////

  /**
   * Sign a permit for an arbitrary ERC-20 token. This allows `spender` to use `value`
   * of `owner`'s `token`.
   *
   * @fixme should this be in `tokens.ts`?
   * @fixme does the order of keys in `message` matter? if not we could make an abstraction here
   * @fixme `permitERC2612` -> `getERC20Permit`?
   *
   * @ref https://github.com/dmihal/eth-permit/blob/34f3fb59f0e32d8c19933184f5a7121ee125d0a5/src/eth-permit.ts#L126
   * @param token a Token instance representing an ERC20 token to permit
   * @param owner
   * @param spender authorize this account to spend `token` on behalf of `owner`
   * @param value the amount of `token` to authorize
   * @param _nonce
   * @param _deadline
   */
  public async permitERC2612(
    owner: string, //
    spender: string,
    token: ERC20Token,
    value: string | number, // FIXME: included default on eth-permit, see @ref
    _nonce?: number, //
    _deadline?: number // FIXME: is MAX_UINT256 an appropriate default?
  ): Promise<EIP712TypedData<EIP2612PermitMessage>> {
    const deadline = _deadline || Permit.MAX_UINT256;
    const [domain, nonce] = await Promise.all([
      this.getEIP712DomainForToken(token),
      // @ts-ignore FIXME
      token
        .getContract()
        .nonces(owner)
        .then((r) => r.toString())
    ]);

    return this.createTypedERC2612Data(domain, {
      owner,
      spender,
      value,
      nonce,
      deadline
    });
  }

  private createTypedERC2612Data = (domain: EIP712Domain, message: EIP2612PermitMessage) => ({
    types: {
      EIP712Domain: Permit.EIP712_DOMAIN,
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    },
    primaryType: "Permit",
    domain,
    message
  });
}
